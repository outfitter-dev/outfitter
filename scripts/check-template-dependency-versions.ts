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

function main(): number {
  const manifest = loadManifest();
  const internal = new Set(Object.keys(manifest.internalDependencies));
  const external = manifest.externalDependencies;

  const templateRoots = ["templates", "apps/outfitter/templates"] as const;
  const problems: string[] = [];

  // Check manifest versions match reality.
  validateManifestVsReality(manifest, problems);

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
