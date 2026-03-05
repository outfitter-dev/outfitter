/** Package discovery and TSDoc coverage analysis. @module */

import { resolve } from "node:path";

import ts from "typescript";

import { analyzeSourceFile, calculateCoverage } from "./tsdoc-analysis.js";
import type {
  CheckTsDocOptions,
  PackageCoverage,
  TsDocCheckResult,
} from "./tsdoc-types.js";

// ---------------------------------------------------------------------------
// Package discovery
// ---------------------------------------------------------------------------

/** Discover packages with src/index.ts entry points. */
export function discoverPackages(
  cwd: string
): Array<{ name: string; path: string; entryPoint: string }> {
  const packages: Array<{ name: string; path: string; entryPoint: string }> =
    [];
  const seenEntryPoints = new Set<string>();

  // Search packages/*/ and apps/*/ for monorepo layouts
  for (const pattern of ["packages/*/src/index.ts", "apps/*/src/index.ts"]) {
    const glob = new Bun.Glob(pattern);
    for (const match of glob.scanSync({ cwd, dot: false })) {
      const parts = match.split("/");
      const rootDir = parts[0];
      const pkgDir = parts[1];
      if (!rootDir || !pkgDir) continue;
      const entryPoint = resolve(cwd, match);
      if (seenEntryPoints.has(entryPoint)) {
        continue;
      }
      seenEntryPoints.add(entryPoint);

      const pkgRoot = resolve(cwd, rootDir, pkgDir);
      let pkgName = pkgDir;

      try {
        const pkgJson = JSON.parse(
          require("node:fs").readFileSync(
            resolve(pkgRoot, "package.json"),
            "utf-8"
          )
        ) as { name?: string };
        if (pkgJson.name) pkgName = pkgJson.name;
      } catch {
        // Fall back to directory name
      }

      packages.push({
        name: pkgName,
        path: pkgRoot,
        entryPoint,
      });
    }
  }

  // Single-app repo: check cwd itself for src/index.ts
  if (packages.length === 0) {
    const entryPoint = resolve(cwd, "src/index.ts");
    try {
      require("node:fs").accessSync(entryPoint);
      let pkgName = "root";
      try {
        const pkgJson = JSON.parse(
          require("node:fs").readFileSync(resolve(cwd, "package.json"), "utf-8")
        ) as { name?: string };
        if (pkgJson.name) pkgName = pkgJson.name;
      } catch {
        // Fall back to "root"
      }
      packages.push({
        name: pkgName,
        path: cwd,
        entryPoint,
      });
      seenEntryPoints.add(entryPoint);
    } catch {
      // No src/index.ts in cwd
    }
  }

  return packages.toSorted((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Re-export traversal
// ---------------------------------------------------------------------------

/**
 * Collect source files referenced by re-exports in a barrel file.
 *
 * For `export { ... } from "./foo"` and `export * from "./bar"`, resolves
 * the module specifier to a source file in the program. Returns only files
 * within the package (skips external modules).
 */
export function collectReExportedSourceFiles(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  pkgPath: string
): ts.SourceFile[] {
  const result: ts.SourceFile[] = [];
  const seen = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.moduleSpecifier) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const specifier = statement.moduleSpecifier.text;
    // Only follow relative imports (within the package)
    if (!specifier.startsWith(".")) continue;

    const resolvedModule = ts.resolveModuleName(
      specifier,
      sourceFile.fileName,
      program.getCompilerOptions(),
      ts.sys
    );
    const resolvedFileName = resolvedModule.resolvedModule?.resolvedFileName;
    if (!resolvedFileName) continue;
    if (!resolvedFileName.startsWith(pkgPath)) continue;
    if (seen.has(resolvedFileName)) continue;
    seen.add(resolvedFileName);

    const sf = program.getSourceFile(resolvedFileName);
    if (sf) result.push(sf);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Package analysis
// ---------------------------------------------------------------------------

/** Analyze a single package entry point, returning coverage data. */
export function analyzePackage(
  pkg: {
    name: string;
    path: string;
    entryPoint: string;
  },
  workspaceCwd: string
): PackageCoverage {
  // Validate entry point exists
  try {
    require("node:fs").accessSync(pkg.entryPoint);
  } catch {
    return {
      name: pkg.name,
      path: pkg.path,
      declarations: [],
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 0,
    };
  }

  // Try to find a tsconfig for this package, fall back to root
  let tsconfigPath = resolve(pkg.path, "tsconfig.json");
  try {
    require("node:fs").accessSync(tsconfigPath);
  } catch {
    tsconfigPath = resolve(workspaceCwd, "tsconfig.json");
  }

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    pkg.path
  );

  const program = ts.createProgram({
    rootNames: [pkg.entryPoint],
    options: parsedConfig.options,
    host: ts.createCompilerHost(parsedConfig.options),
  });

  const sourceFile = program.getSourceFile(pkg.entryPoint);
  if (!sourceFile) {
    return {
      name: pkg.name,
      path: pkg.path,
      declarations: [],
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 0,
    };
  }

  // Analyze direct exports in the entry point
  const declarations = analyzeSourceFile(sourceFile);

  // Follow re-exports into their source files (barrel pattern)
  const reExportedFiles = collectReExportedSourceFiles(
    sourceFile,
    program,
    pkg.path
  );
  for (const sf of reExportedFiles) {
    declarations.push(...analyzeSourceFile(sf));
  }

  const stats = calculateCoverage(declarations);

  return {
    name: pkg.name,
    path: pkg.path,
    declarations,
    ...stats,
  };
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

/**
 * Analyze TSDoc coverage across workspace packages.
 *
 * Pure function that discovers packages, analyzes TSDoc coverage on exported
 * declarations, and returns the aggregated result. Does not print output or
 * call `process.exit()`.
 *
 * @param options - Analysis options (paths, strict mode, coverage threshold)
 * @returns Aggregated coverage result across all packages, or `null` if no packages found
 */
export function analyzeCheckTsdoc(
  options: CheckTsDocOptions = {}
): TsDocCheckResult | null {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const minCoverage = options.minCoverage ?? 0;

  // Discover or use provided paths
  let packages: Array<{ name: string; path: string; entryPoint: string }>;

  if (options.paths && options.paths.length > 0) {
    packages = options.paths.map((p) => {
      const absPath = resolve(cwd, p);
      const entryPoint = resolve(absPath, "src/index.ts");
      let name = p;

      try {
        const pkgJson = JSON.parse(
          require("node:fs").readFileSync(
            resolve(absPath, "package.json"),
            "utf-8"
          )
        ) as { name?: string };
        if (pkgJson.name) name = pkgJson.name;
      } catch {
        // Fall back to path
      }

      return { name, path: absPath, entryPoint };
    });
  } else {
    packages = discoverPackages(cwd);
  }

  if (packages.length === 0) {
    return null;
  }

  // Analyze each package
  const packageResults: PackageCoverage[] = [];
  for (const pkg of packages) {
    packageResults.push(analyzePackage(pkg, cwd));
  }

  // Aggregate summary
  const allDeclarations = packageResults.flatMap((p) => p.declarations);
  const summary = calculateCoverage(allDeclarations);

  const ok = !options.strict || summary.percentage >= minCoverage;

  return {
    ok,
    packages: packageResults,
    summary,
  };
}
