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

function getTemplatePackageJsonPaths(rootDir: string): readonly string[] {
  const glob = new Bun.Glob("**/package.json.template");
  return Array.from(glob.scanSync({ cwd: rootDir, absolute: false }))
    .map((relative) => join(rootDir, relative))
    .sort();
}

function loadRootPackageJson(): Record<string, unknown> {
  const raw: unknown = JSON.parse(readFileSync("package.json", "utf-8"));
  if (!isRecord(raw)) {
    throw new Error("Root package.json must be a JSON object");
  }
  return raw;
}

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

function validateBiomeSchemaUrls(
  expectedBiomeVersion: string,
  problems: string[]
): void {
  const baseVersion = stripRangePrefix(expectedBiomeVersion);
  const glob = new Bun.Glob(
    "{templates,packages/presets/presets}/**/biome.json.template"
  );
  for (const path of glob.scanSync({ absolute: false })) {
    try {
      const content = readFileSync(path, "utf-8");
      const match = content.match(
        /biomejs\.dev\/schemas\/([\d.]+)\/schema\.json/
      );
      if (match && match[1] !== baseVersion) {
        problems.push(
          `biome schema drift: ${path} has schema version ${match[1]} but expected ${baseVersion}`
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

function validateBunVersionConsistency(problems: string[]): void {
  const bunVersionFile = readFileSync(".bun-version", "utf-8").trim();

  const rootPkg = loadRootPackageJson();
  const engines = rootPkg["engines"];
  if (isRecord(engines) && typeof engines["bun"] === "string") {
    const engineBun = stripRangePrefix(engines["bun"]);
    if (engineBun !== bunVersionFile) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but engines.bun is ${engines["bun"]}`
      );
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

  const docsWithBunVersion = ["README.md", "apps/outfitter/README.md"] as const;

  for (const docPath of docsWithBunVersion) {
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

function main(): number {
  // Resolved versions from @outfitter/presets (catalog-resolved).
  const { all: resolvedVersions } = getResolvedVersions();

  const templateRoots = ["templates", "packages/presets/presets"] as const;
  const problems: string[] = [];

  // Check biome schema URLs match the resolved biome version.
  const biomeVersion = resolvedVersions["@biomejs/biome"];
  if (biomeVersion) {
    validateBiomeSchemaUrls(biomeVersion, problems);
  }

  // Check Bun version consistency across the repo.
  validateBunVersionConsistency(problems);

  // Check template package.json files use correct versions.
  for (const templateRoot of templateRoots) {
    for (const templatePath of getTemplatePackageJsonPaths(templateRoot)) {
      const parsed: unknown = JSON.parse(readFileSync(templatePath, "utf-8"));
      if (!isRecord(parsed)) {
        continue;
      }

      for (const section of DEPENDENCY_SECTIONS) {
        const sectionValue = parsed[section];
        if (!isRecord(sectionValue)) {
          continue;
        }

        for (const [name, value] of Object.entries(sectionValue)) {
          if (typeof value !== "string") {
            continue;
          }

          // Internal @outfitter/* deps must use workspace:* in templates.
          if (name.startsWith("@outfitter/") && value !== "workspace:*") {
            problems.push(
              `${templatePath}: ${name} must use workspace:* in templates (found ${value})`
            );
          }

          // External deps must match resolved presets versions (base version).
          const expectedExternal = resolvedVersions[name];
          if (
            expectedExternal &&
            stripRangePrefix(value) !== stripRangePrefix(expectedExternal)
          ) {
            problems.push(
              `${templatePath}: ${name} expected ${expectedExternal} (found ${value})`
            );
          }
        }
      }
    }
  }

  if (problems.length > 0) {
    process.stderr.write(
      `Template dependency version drift detected (${problems.length} issue(s)):\n`
    );
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    return 1;
  }

  process.stdout.write("Template dependency versions are in sync.\n");
  return 0;
}

process.exit(main());
