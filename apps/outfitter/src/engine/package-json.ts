/**
 * Helpers for writing scaffolded package manifests in a stable order.
 *
 * Ultracite applies deterministic ordering within `package.json` sections such
 * as scripts and dependency maps. Keeping that order at write time prevents
 * generated projects from failing `check` immediately after scaffolding.
 *
 * @packageDocumentation
 */

/**
 * Canonical top-level field ordering for outfitter-managed package.json files.
 * Fields not listed here are appended in their original order after the known
 * fields, preserving any custom keys the template defines.
 */
const TOP_LEVEL_KEY_ORDER = [
  "name",
  "version",
  "description",
  "keywords",
  "license",
  "author",
  "homepage",
  "repository",
  "bugs",
  "funding",
  "files",
  "type",
  "private",
  "workspaces",
  "sideEffects",
  "main",
  "module",
  "types",
  "typings",
  "bin",
  "exports",
  "imports",
  "scripts",
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "engines",
  "os",
  "cpu",
  "publishConfig",
  "overrides",
  "resolutions",
] as const;

const SORTED_PACKAGE_JSON_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "scripts",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}

function orderTopLevelKeys(
  packageJson: Record<string, unknown>
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of TOP_LEVEL_KEY_ORDER) {
    if (key in packageJson) {
      ordered[key] = packageJson[key];
      seen.add(key);
    }
  }

  // Append remaining keys in original order
  for (const key of Object.keys(packageJson)) {
    if (!seen.has(key)) {
      ordered[key] = packageJson[key];
    }
  }

  return ordered;
}

export function normalizePackageJsonForWrite(
  packageJson: Record<string, unknown>
): Record<string, unknown> {
  const normalized = orderTopLevelKeys(packageJson);

  for (const section of SORTED_PACKAGE_JSON_SECTIONS) {
    const value = normalized[section];
    if (isRecord(value)) {
      normalized[section] = sortRecord(value);
    }
  }

  return normalized;
}

export function serializePackageJson(
  packageJson: Record<string, unknown>
): string {
  return `${JSON.stringify(normalizePackageJsonForWrite(packageJson), null, 2)}\n`;
}
