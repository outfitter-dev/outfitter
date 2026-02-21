import { readFileSync } from "node:fs";
import { join } from "node:path";

interface TemplateVersionManifest {
  readonly externalDependencies: Record<string, string>;
  readonly internalDependencies: Record<string, string>;
}

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadManifest(): TemplateVersionManifest {
  const raw: unknown = JSON.parse(
    readFileSync("apps/outfitter/template-versions.json", "utf-8")
  );
  if (!isRecord(raw)) {
    throw new Error("template-versions.json must be a JSON object");
  }

  const internalDependencies = raw["internalDependencies"];
  const externalDependencies = raw["externalDependencies"];

  return {
    internalDependencies: isRecord(internalDependencies)
      ? Object.fromEntries(
          Object.entries(internalDependencies).filter(
            ([, v]) => typeof v === "string"
          )
        )
      : {},
    externalDependencies: isRecord(externalDependencies)
      ? Object.fromEntries(
          Object.entries(externalDependencies).filter(
            ([, v]) => typeof v === "string"
          )
        )
      : {},
  };
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

function collectRootDependencyVersions(
  rootPkg: Record<string, unknown>
): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = rootPkg[section];
    if (!isRecord(sectionValue)) continue;
    for (const [name, value] of Object.entries(sectionValue)) {
      if (typeof value === "string") {
        versions[name] = value;
      }
    }
  }
  return versions;
}

function collectWorkspacePackageVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  const glob = new Bun.Glob("packages/*/package.json");
  for (const path of glob.scanSync({ absolute: false })) {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
      if (!isRecord(raw)) continue;
      const name = raw["name"];
      const version = raw["version"];
      if (typeof name === "string" && typeof version === "string") {
        versions[name] = `^${version}`;
      }
    } catch {
      // Skip malformed package.json files.
    }
  }
  return versions;
}

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

function validateManifestVsReality(
  manifest: TemplateVersionManifest,
  problems: string[]
): void {
  const rootPkg = loadRootPackageJson();
  const rootDeps = collectRootDependencyVersions(rootPkg);
  const workspaceVersions = collectWorkspacePackageVersions();

  for (const [name, manifestVersion] of Object.entries(
    manifest.externalDependencies
  )) {
    const realVersion = rootDeps[name];
    if (
      realVersion &&
      stripRangePrefix(realVersion) !== stripRangePrefix(manifestVersion)
    ) {
      problems.push(
        `manifest drift: ${name} in template-versions.json is ${manifestVersion} but root package.json has ${realVersion}`
      );
    }
  }

  for (const [name, manifestVersion] of Object.entries(
    manifest.internalDependencies
  )) {
    const realVersion = workspaceVersions[name];
    if (
      realVersion &&
      stripRangePrefix(realVersion) !== stripRangePrefix(manifestVersion)
    ) {
      problems.push(
        `manifest drift: ${name} in template-versions.json is ${manifestVersion} but workspace package version is ${realVersion}`
      );
    }
  }
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
  const manifest = loadManifest();
  const internal = new Set(Object.keys(manifest.internalDependencies));
  const external = manifest.externalDependencies;

  const templateRoots = ["templates", "packages/presets/presets"] as const;
  const problems: string[] = [];

  // Check manifest versions match reality.
  validateManifestVsReality(manifest, problems);

  // Check biome schema URLs match the manifest biome version.
  const biomeVersion = manifest.externalDependencies["@biomejs/biome"];
  if (biomeVersion) {
    validateBiomeSchemaUrls(biomeVersion, problems);
  }

  // Check Bun version consistency across the repo.
  validateBunVersionConsistency(problems);

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

          if (internal.has(name) && value !== "workspace:*") {
            problems.push(
              `${templatePath}: ${name} must use workspace:* in templates (found ${value})`
            );
          }

          const expectedExternal = external[name];
          if (expectedExternal && value !== expectedExternal) {
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
