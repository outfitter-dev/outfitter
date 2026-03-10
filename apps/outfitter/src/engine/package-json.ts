/**
 * Helpers for writing scaffolded package manifests in a stable order.
 *
 * Ultracite applies deterministic ordering within `package.json` sections such
 * as scripts and dependency maps. Keeping that order at write time prevents
 * generated projects from failing `check` immediately after scaffolding.
 *
 * @packageDocumentation
 */

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

export function normalizePackageJsonForWrite(
  packageJson: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...packageJson };

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
