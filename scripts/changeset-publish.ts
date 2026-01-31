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
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
  packageJson: PackageJson;
}

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PACKAGES_DIR = join(ROOT, "packages");
const APPS_DIR = join(ROOT, "apps");

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

function rewriteWorkspaceRanges(
  pkg: WorkspacePackage,
  versionMap: Map<string, string>
): boolean {
  let changed = false;
  const sections: (keyof PackageJson)[] = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  for (const section of sections) {
    const deps = pkg.packageJson[section];
    if (!deps) continue;
    for (const [depName, range] of Object.entries(deps)) {
      const next = resolveWorkspaceRange(depName, range, versionMap);
      if (next !== range) {
        deps[depName] = next;
        changed = true;
      }
    }
  }

  return changed;
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
  const originals = new Map<string, string>();

  // Transform workspace:* to actual versions
  let transformedCount = 0;
  for (const pkg of workspacePackages) {
    originals.set(pkg.path, readFileSync(pkg.path, "utf8"));
    const changed = rewriteWorkspaceRanges(pkg, versionMap);
    if (changed) {
      writePackageJson(
        pkg.path,
        pkg.packageJson,
        originals.get(pkg.path) ?? ""
      );
      transformedCount++;
    }
  }
  console.log(`Transformed workspace refs in ${transformedCount} packages`);

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
