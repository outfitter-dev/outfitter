/**
 * Changeset publish wrapper that transforms workspace:* references to actual versions.
 *
 * Problem: `changeset publish` doesn't transform workspace protocol references,
 * causing published packages to have unresolvable `workspace:*` dependencies.
 *
 * Solution: Transform workspace refs before publish, restore after.
 *
 * @see https://github.com/outfitter-dev/outfitter/issues/192
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  private?: boolean;
  version?: string;
}

type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

interface WorkspacePackage {
  name: string;
  packageJson: PackageJson;
  path: string;
  version: string;
}

interface WorkspaceRangeReference {
  dependency: string;
  range: string;
  section: DependencySection;
}

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PACKAGES_DIR = join(ROOT, "packages");
const APPS_DIR = join(ROOT, "apps");
const DEPENDENCY_SECTIONS: DependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function run(command: string, args: string[], cwd = ROOT): void {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed with exit code ${result.exitCode}`);
  }
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function listWorkspacePackages(): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];

  for (const dir of [PACKAGES_DIR, APPS_DIR]) {
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name, "package.json"))
      .filter((path) => existsSync(path))
      .map((path) => {
        const packageJson = readPackageJson(path);
        if (!(packageJson.name && packageJson.version)) {
          throw new Error(`Missing name or version in ${path}`);
        }
        return {
          name: packageJson.name,
          version: packageJson.version,
          path,
          packageJson,
        };
      });

    packages.push(...entries);
  }

  return packages;
}

function resolveWorkspaceRange(
  depName: string,
  range: string,
  versionMap: Map<string, string>
): string {
  if (!range.startsWith("workspace:")) {
    return range;
  }

  const depVersion = versionMap.get(depName);
  if (!depVersion) {
    throw new Error(`Missing workspace version for ${depName}`);
  }

  const token = range.slice("workspace:".length);
  if (!token || token === "*") {
    return depVersion;
  }
  if (token === "^") {
    return `^${depVersion}`;
  }
  if (token === "~") {
    return `~${depVersion}`;
  }
  return token;
}

function loadCatalogMap(): Map<string, string> {
  const rootPackagePath = join(ROOT, "package.json");
  const rootPackageJson = readPackageJson(rootPackagePath);
  const catalog = rootPackageJson["catalog"];
  if (!catalog || typeof catalog !== "object") {
    return new Map();
  }

  return new Map(
    Object.entries(catalog).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function resolveProtocolRange(
  depName: string,
  range: string,
  versionMap: Map<string, string>,
  catalogMap: Map<string, string>
): string {
  if (range === "catalog:") {
    const catalogVersion = catalogMap.get(depName);
    if (!catalogVersion) {
      throw new Error(`Missing catalog version for ${depName}`);
    }
    return catalogVersion;
  }

  return resolveWorkspaceRange(depName, range, versionMap);
}

function rewriteProtocolRanges(
  pkg: WorkspacePackage,
  versionMap: Map<string, string>,
  catalogMap: Map<string, string>
): boolean {
  let changed = false;

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg.packageJson[section];
    if (!deps) continue;
    for (const [depName, range] of Object.entries(deps)) {
      const next = resolveProtocolRange(depName, range, versionMap, catalogMap);
      if (next !== range) {
        deps[depName] = next;
        changed = true;
      }
    }
  }

  return changed;
}

function findProtocolRangeReferences(
  pkg: WorkspacePackage
): WorkspaceRangeReference[] {
  const references: WorkspaceRangeReference[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = pkg.packageJson[section];
    if (!deps) continue;
    for (const [dependency, range] of Object.entries(deps)) {
      if (
        typeof range === "string" &&
        (range.startsWith("workspace:") || range === "catalog:")
      ) {
        references.push({ dependency, range, section });
      }
    }
  }

  return references;
}

function assertNoProtocolRanges(packages: WorkspacePackage[]): void {
  const issues = packages.flatMap((pkg) =>
    findProtocolRangeReferences(pkg).map((reference) => ({
      packageName: pkg.name,
      path: pkg.path,
      ...reference,
    }))
  );
  if (issues.length === 0) {
    return;
  }

  const details = issues
    .map(
      (issue) =>
        `- ${issue.packageName} (${issue.section}) ${issue.dependency}: ${issue.range}`
    )
    .join("\n");

  throw new Error(
    ["Protocol ranges remain after publish manifest rewrite.", details].join(
      "\n"
    )
  );
}

function writePackageJson(
  path: string,
  pkg: PackageJson,
  original: string
): void {
  const indent = original.includes("\t") ? "\t" : 2;
  writeFileSync(path, `${JSON.stringify(pkg, null, indent)}\n`);
}

function main(): void {
  const workspacePackages = listWorkspacePackages();
  const versionMap = new Map(
    workspacePackages.map((pkg) => [pkg.name, pkg.version])
  );
  const catalogMap = loadCatalogMap();
  const originals = new Map<string, string>();

  // Transform workspace:* and catalog: references to concrete versions.
  let transformedCount = 0;
  for (const pkg of workspacePackages) {
    originals.set(pkg.path, readFileSync(pkg.path, "utf8"));
    const changed = rewriteProtocolRanges(pkg, versionMap, catalogMap);
    if (changed) {
      writePackageJson(
        pkg.path,
        pkg.packageJson,
        originals.get(pkg.path) ?? ""
      );
      transformedCount++;
    }
  }
  console.log(`Transformed protocol refs in ${transformedCount} packages`);
  assertNoProtocolRanges(workspacePackages);

  try {
    // Let changeset handle the actual publishing
    run("npx", ["changeset", "publish"]);
  } finally {
    // Always restore original package.json files
    for (const pkg of workspacePackages) {
      const original = originals.get(pkg.path);
      if (original !== undefined) {
        writeFileSync(pkg.path, original);
      }
    }
    console.log("Restored original package.json files");
  }
}

main();
