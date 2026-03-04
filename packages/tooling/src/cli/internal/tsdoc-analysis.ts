/**
 * Pure analysis functions for TSDoc coverage checking.
 *
 * Handles AST inspection, declaration classification, source file analysis,
 * coverage calculation, package discovery, and re-export traversal.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import ts from "typescript";

import type {
  CheckTsDocOptions,
  CoverageLevel,
  DeclarationCoverage,
  PackageCoverage,
  TsDocCheckResult,
} from "./tsdoc-types.js";

// ---------------------------------------------------------------------------
// Declaration inspection
// ---------------------------------------------------------------------------

/**
 * Check whether a node is an exported declaration worth checking.
 *
 * Returns true for function, interface, type alias, class, enum, and variable
 * declarations that carry the `export` keyword. Re-exports (`export { ... } from`)
 * and `export *` are excluded since TSDoc belongs at the definition site.
 */
export function isExportedDeclaration(node: ts.Node): boolean {
  // Exclude re-exports: export { ... } from "..."
  if (ts.isExportDeclaration(node)) return false;

  // Exclude export * from "..."
  if (ts.isExportAssignment(node)) return false;

  // Must be a supported declaration kind
  const isDeclaration =
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableStatement(node);

  if (!isDeclaration) return false;

  // Check for export modifier
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  if (!modifiers) return false;

  return modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Extract the name of a declaration node.
 *
 * For variable statements, returns the name of the first variable declarator.
 * Returns `undefined` for anonymous declarations (e.g., `export default function() {}`).
 */
export function getDeclarationName(node: ts.Node): string | undefined {
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) {
      return decl.name.text;
    }
    return undefined;
  }

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.text;
  }

  return undefined;
}

/**
 * Determine the kind label for a declaration node.
 *
 * Maps AST node types to human-readable kind strings used in coverage reports.
 */
export function getDeclarationKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableStatement(node)) return "variable";
  return "unknown";
}

// ---------------------------------------------------------------------------
// JSDoc detection
// ---------------------------------------------------------------------------

/**
 * Check whether a node has a leading JSDoc comment (starts with `/**`).
 *
 * Uses `ts.getLeadingCommentRanges` to inspect the raw source text,
 * filtering for block comments that begin with the JSDoc marker.
 */
function hasJSDocComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  const sourceText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart());
  if (!ranges) return false;

  return ranges.some((range) => {
    if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
    const text = sourceText.slice(range.pos, range.end);
    return text.startsWith("/**");
  });
}

/**
 * Check whether a member node (property, method) has a leading JSDoc comment.
 */
function memberHasJSDoc(member: ts.Node, sourceFile: ts.SourceFile): boolean {
  const sourceText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(sourceText, member.getFullStart());
  if (!ranges) return false;

  return ranges.some((range) => {
    if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
    const text = sourceText.slice(range.pos, range.end);
    return text.startsWith("/**");
  });
}

// ---------------------------------------------------------------------------
// Declaration classification
// ---------------------------------------------------------------------------

/**
 * Classify a declaration's TSDoc coverage level.
 *
 * - `"documented"` -- has a JSDoc comment with a description. For interfaces
 *   and classes, all members must also have JSDoc comments.
 * - `"partial"` -- the declaration has a JSDoc comment but some members
 *   (in interfaces/classes) lack documentation.
 * - `"undocumented"` -- no JSDoc comment at all.
 */
export function classifyDeclaration(
  node: ts.Node,
  sourceFile: ts.SourceFile
): CoverageLevel {
  const hasDoc = hasJSDocComment(node, sourceFile);

  if (!hasDoc) return "undocumented";

  // For interfaces and classes, check member documentation
  if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
    const members = node.members;
    if (members.length > 0) {
      const allMembersDocumented = members.every((member) =>
        memberHasJSDoc(member, sourceFile)
      );
      if (!allMembersDocumented) return "partial";
    }
  }

  return "documented";
}

// ---------------------------------------------------------------------------
// Source file analysis
// ---------------------------------------------------------------------------

/**
 * Analyze all exported declarations in a source file for TSDoc coverage.
 *
 * Walks top-level statements, filters to exported declarations, and
 * classifies each for documentation coverage.
 */
export function analyzeSourceFile(
  sourceFile: ts.SourceFile
): DeclarationCoverage[] {
  const results: DeclarationCoverage[] = [];

  for (const statement of sourceFile.statements) {
    if (!isExportedDeclaration(statement)) continue;

    const name = getDeclarationName(statement);
    if (!name) continue;

    const kind = getDeclarationKind(statement);
    const level = classifyDeclaration(statement, sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart(sourceFile)
    );

    results.push({
      name,
      kind,
      level,
      file: sourceFile.fileName,
      line: line + 1, // Convert 0-based to 1-based
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Coverage calculation
// ---------------------------------------------------------------------------

/**
 * Calculate aggregate coverage statistics from declaration results.
 *
 * Partial documentation counts as half coverage in the percentage calculation.
 * An empty array returns 100% (no declarations to check).
 */
export function calculateCoverage(
  declarations: readonly DeclarationCoverage[]
): {
  documented: number;
  partial: number;
  undocumented: number;
  total: number;
  percentage: number;
} {
  const total = declarations.length;
  if (total === 0) {
    return {
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 100,
    };
  }

  const documented = declarations.filter(
    (d) => d.level === "documented"
  ).length;
  const partial = declarations.filter((d) => d.level === "partial").length;
  const undocumented = declarations.filter(
    (d) => d.level === "undocumented"
  ).length;

  // Partial counts as half
  const score = documented + partial * 0.5;
  const percentage = Math.round((score / total) * 100);

  return { documented, partial, undocumented, total, percentage };
}

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
