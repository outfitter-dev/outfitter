/**
 * CI drift check for catalog architecture.
 *
 * Validates that preset files, registry blocks, and source files
 * stay in sync with the canonical versions from @outfitter/presets.
 *
 * Checks:
 * 1. Preset deps match presets (base version comparison)
 * 2. Registry.json devDependency versions match presets
 * 3. Biome schema URLs match the catalog biome version
 * 4. Bun version is consistent across .bun-version, engines, and docs
 * 5. No stale hardcoded version fallbacks in source files
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getResolvedVersions } from "@outfitter/presets";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeVersionRange(version: string): string {
  const trimmed = version.trim();
  const semverMatch = trimmed.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  if (semverMatch) {
    return semverMatch[0];
  }
  return trimmed.replace(/^[\^~>=<]+/, "");
}

// --- Check 1: Preset deps ---

function validatePresetDeps(
  resolvedVersions: Readonly<Record<string, string>>,
  problems: string[]
): void {
  const templateRoots = ["templates", "packages/presets/presets"] as const;
  const glob = new Bun.Glob("**/package.json.template");

  for (const root of templateRoots) {
    for (const relative of glob.scanSync({ cwd: root, absolute: false })) {
      const templatePath = join(root, relative);
      const parsed: unknown = JSON.parse(readFileSync(templatePath, "utf-8"));
      if (!isRecord(parsed)) continue;

      for (const section of DEPENDENCY_SECTIONS) {
        const deps = parsed[section];
        if (!isRecord(deps)) continue;

        for (const [name, value] of Object.entries(deps)) {
          if (typeof value !== "string") continue;

          if (name.startsWith("@outfitter/")) {
            if (value !== "workspace:*") {
              problems.push(
                `${templatePath}: ${name} must use workspace:* (found ${value})`
              );
            }
            continue;
          }

          // Template-local/workspace package references are dynamic placeholders.
          if (name.includes("{{") || value.startsWith("workspace:")) {
            continue;
          }

          const expected = resolvedVersions[name];
          if (!expected) {
            problems.push(
              `${templatePath}: external dependency "${name}" is not declared in @outfitter/presets`
            );
            continue;
          }

          if (
            normalizeVersionRange(value) !== normalizeVersionRange(expected)
          ) {
            problems.push(
              `${templatePath}: ${name} expected ${expected} (found ${value})`
            );
          }
        }
      }
    }
  }
}

// --- Check 2: Registry freshness ---

function validateRegistryVersions(
  resolvedVersions: Readonly<Record<string, string>>,
  problems: string[]
): void {
  const registryPath = "packages/tooling/registry/registry.json";
  let registry: unknown;
  try {
    registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  } catch {
    problems.push(`Registry not found or unreadable: ${registryPath}`);
    return;
  }
  if (!isRecord(registry)) {
    problems.push(
      `Registry has invalid shape (expected object): ${registryPath}`
    );
    return;
  }
  if (!isRecord(registry["blocks"])) {
    problems.push(
      `Registry has invalid shape (missing object "blocks" field): ${registryPath}`
    );
    return;
  }

  for (const [blockName, block] of Object.entries(registry["blocks"])) {
    if (!isRecord(block)) continue;
    const devDeps = block["devDependencies"];
    if (!isRecord(devDeps)) continue;

    for (const [name, value] of Object.entries(devDeps)) {
      if (typeof value !== "string") continue;
      // Skip internal @outfitter/* deps — those use workspace-derived versions.
      if (name.startsWith("@outfitter/")) continue;

      const expected = resolvedVersions[name];
      if (
        expected &&
        normalizeVersionRange(value) !== normalizeVersionRange(expected)
      ) {
        problems.push(
          `registry block "${blockName}": ${name} expected ${expected} (found ${value})`
        );
      }
    }
  }
}

// --- Check 3: Biome schema URLs ---

function validateBiomeSchemaUrls(
  expectedBiomeVersion: string,
  problems: string[]
): void {
  const baseVersion = normalizeVersionRange(expectedBiomeVersion);
  const templateRoots = ["templates", "packages/presets/presets"] as const;
  const glob = new Bun.Glob("**/biome.json.template");
  for (const root of templateRoots) {
    for (const relativePath of glob.scanSync({ cwd: root, absolute: false })) {
      const path = join(root, relativePath);
      try {
        const content = readFileSync(path, "utf-8");
        const match = content.match(
          /biomejs\.dev\/schemas\/([\d.]+)\/schema\.json/
        );
        if (match && match[1] !== baseVersion) {
          problems.push(
            `biome schema drift: ${path} has ${match[1]} but expected ${baseVersion}`
          );
        }
      } catch {
        // Skip unreadable files.
      }
    }
  }
}

// --- Check 4: Bun version consistency ---

function validateBunVersionConsistency(problems: string[]): void {
  const bunVersionFile = readFileSync(".bun-version", "utf-8").trim();

  const rootPkg: unknown = JSON.parse(readFileSync("package.json", "utf-8"));
  if (isRecord(rootPkg)) {
    const engines = rootPkg["engines"];
    if (isRecord(engines) && typeof engines["bun"] === "string") {
      const engineBun = normalizeVersionRange(engines["bun"]);
      if (engineBun !== bunVersionFile) {
        problems.push(
          `Bun version drift: .bun-version is ${bunVersionFile} but engines.bun is ${engines["bun"]}`
        );
      }
    }

    let bunTypesVersion: string | undefined;
    const catalog = rootPkg["catalog"];
    if (isRecord(catalog) && typeof catalog["@types/bun"] === "string") {
      bunTypesVersion = catalog["@types/bun"];
    }
    if (!bunTypesVersion) {
      const devDependencies = rootPkg["devDependencies"];
      if (
        isRecord(devDependencies) &&
        typeof devDependencies["@types/bun"] === "string"
      ) {
        bunTypesVersion = devDependencies["@types/bun"];
      }
    }
    if (
      bunTypesVersion &&
      normalizeVersionRange(bunTypesVersion) !== bunVersionFile
    ) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but @types/bun is ${bunTypesVersion}`
      );
    }
  }

  for (const docPath of ["README.md", "apps/outfitter/README.md"] as const) {
    try {
      const content = readFileSync(docPath, "utf-8");
      const match = content.match(/\bbun\b\s*(?:>=|>|=)\s*([\d.]+)/i);
      if (match && match[1] !== bunVersionFile) {
        problems.push(
          `Bun version drift: ${docPath} references Bun ${match[1]} but .bun-version is ${bunVersionFile}`
        );
      }
    } catch {
      // Skip missing docs.
    }
  }
}

// --- Check 5: No stale fallbacks ---

function validateNoStaleFallbacks(problems: string[]): void {
  const filesToCheck = [
    "apps/outfitter/src/commands/shared-deps.ts",
    "packages/tooling/src/registry/build.ts",
  ] as const;

  // Match patterns like: ?? "^1.2.3" or || "1.2.3" (fallback version strings).
  const fallbackPattern = /(?:\?\?|\|\|)\s*["']\^?[\d]+\.[\d]+\.[\d]+["']/;

  for (const filePath of filesToCheck) {
    try {
      const content = readFileSync(filePath, "utf-8");
      for (const [i, line] of content.split("\n").entries()) {
        if (fallbackPattern.test(line)) {
          problems.push(
            `stale fallback: ${filePath}:${i + 1} contains hardcoded version fallback`
          );
        }
      }
    } catch {
      // Skip missing files.
    }
  }
}

// --- Main ---

function main(): number {
  const { all: resolvedVersions } = getResolvedVersions();
  const problems: string[] = [];

  validatePresetDeps(resolvedVersions, problems);
  validateRegistryVersions(resolvedVersions, problems);

  const biomeVersion = resolvedVersions["@biomejs/biome"];
  if (biomeVersion) {
    validateBiomeSchemaUrls(biomeVersion, problems);
  }

  validateBunVersionConsistency(problems);
  validateNoStaleFallbacks(problems);

  if (problems.length > 0) {
    process.stderr.write(
      `Version drift detected (${problems.length} issue(s)):\n`
    );
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    return 1;
  }

  process.stdout.write("All version checks passed.\n");
  return 0;
}

process.exit(main());
