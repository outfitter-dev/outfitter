import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export interface TemplateVersionManifest {
  readonly internalDependencies: Record<string, string>;
  readonly externalDependencies: Record<string, string>;
}

export interface ResolvedTemplateDependencyVersions {
  readonly internal: Record<string, string>;
  readonly external: Record<string, string>;
}

let cachedResolvedVersions: ResolvedTemplateDependencyVersions | undefined;

export function clearResolvedVersionsCache(): void {
  cachedResolvedVersions = undefined;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRange(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "workspace:*") {
    return undefined;
  }
  if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(trimmed)) {
    return `^${trimmed}`;
  }
  return trimmed;
}

function findOutfitterPackageRoot(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i += 1) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = readJsonFile(packageJsonPath);
        if (
          isRecord(parsed) &&
          typeof parsed["name"] === "string" &&
          parsed["name"] === "outfitter"
        ) {
          return currentDir;
        }
      } catch {
        // Continue walking up.
      }
    }
    currentDir = dirname(currentDir);
  }

  throw new Error(
    `Unable to find outfitter package root (walked 10 levels up from ${dirname(fileURLToPath(import.meta.url))}). ` +
      "Ensure this module is running from within the outfitter package tree."
  );
}

function collectDependencyRangesFromPackageJson(
  packageJson: Record<string, unknown>
): Record<string, string> {
  const collected: Record<string, string> = {};

  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = packageJson[section];
    if (!isRecord(sectionValue)) {
      continue;
    }

    for (const [name, value] of Object.entries(sectionValue)) {
      if (typeof value !== "string" || !name.startsWith("@outfitter/")) {
        continue;
      }
      const normalized = normalizeRange(value);
      if (normalized) {
        collected[name] = normalized;
      }
    }
  }

  return collected;
}

function collectWorkspacePackageRanges(
  packageRoot: string
): Record<string, string> {
  const repoRoot = resolve(packageRoot, "..", "..");
  const expectedPackageRoot = join(repoRoot, "apps", "outfitter");
  if (resolve(expectedPackageRoot) !== resolve(packageRoot)) {
    return {};
  }

  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) {
    return {};
  }

  const collected: Record<string, string> = {};
  for (const entry of readdirSync(packagesDir)) {
    const packageJsonPath = join(packagesDir, entry, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const parsed = readJsonFile(packageJsonPath);
      if (!isRecord(parsed)) {
        continue;
      }

      const name = parsed["name"];
      const version = parsed["version"];
      if (
        typeof name === "string" &&
        typeof version === "string" &&
        name.startsWith("@outfitter/")
      ) {
        const normalized = normalizeRange(version);
        if (normalized) {
          collected[name] = normalized;
        }
      }
    } catch {
      // Ignore malformed workspace package.json entries.
    }
  }

  return collected;
}

function loadTemplateVersionManifest(
  packageRoot: string
): TemplateVersionManifest {
  const manifestPath = join(packageRoot, "template-versions.json");
  const parsed = readJsonFile(manifestPath);
  if (!isRecord(parsed)) {
    throw new Error("template-versions.json must be a JSON object");
  }

  const internalDependencies = parsed["internalDependencies"];
  const externalDependencies = parsed["externalDependencies"];
  if (!(isRecord(internalDependencies) && isRecord(externalDependencies))) {
    throw new Error(
      "template-versions.json must include internalDependencies and externalDependencies objects"
    );
  }

  return {
    internalDependencies: Object.fromEntries(
      Object.entries(internalDependencies).filter(
        ([, value]) => typeof value === "string"
      ) as readonly (readonly [string, string])[]
    ),
    externalDependencies: Object.fromEntries(
      Object.entries(externalDependencies).filter(
        ([, value]) => typeof value === "string"
      ) as readonly (readonly [string, string])[]
    ),
  };
}

export function resolveTemplateDependencyVersions(): ResolvedTemplateDependencyVersions {
  if (cachedResolvedVersions) {
    return cachedResolvedVersions;
  }

  const packageRoot = findOutfitterPackageRoot();
  const manifest = loadTemplateVersionManifest(packageRoot);

  const packageJsonPath = join(packageRoot, "package.json");
  const raw = existsSync(packageJsonPath)
    ? readJsonFile(packageJsonPath)
    : undefined;
  const fromOutfitterPackage =
    raw !== undefined && isRecord(raw)
      ? collectDependencyRangesFromPackageJson(raw)
      : {};
  const fromWorkspacePackages = collectWorkspacePackageRanges(packageRoot);

  const internal: Record<string, string> = {};
  for (const [name, fallbackRange] of Object.entries(
    manifest.internalDependencies
  )) {
    internal[name] =
      fromOutfitterPackage[name] ??
      fromWorkspacePackages[name] ??
      fallbackRange;
  }

  cachedResolvedVersions = {
    internal,
    external: { ...manifest.externalDependencies },
  };
  return cachedResolvedVersions;
}

export function applyResolvedDependencyVersions(
  parsedPackageJson: Record<string, unknown>,
  versions: ResolvedTemplateDependencyVersions
): void {
  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = parsedPackageJson[section];
    if (!isRecord(sectionValue)) {
      continue;
    }

    for (const [name, value] of Object.entries(sectionValue)) {
      if (typeof value !== "string") {
        continue;
      }

      if (name.startsWith("@outfitter/")) {
        const resolvedInternal = versions.internal[name];
        if (resolvedInternal) {
          sectionValue[name] = resolvedInternal;
        }
        continue;
      }

      const resolvedExternal = versions.external[name];
      if (resolvedExternal) {
        sectionValue[name] = resolvedExternal;
      }
    }
  }
}
