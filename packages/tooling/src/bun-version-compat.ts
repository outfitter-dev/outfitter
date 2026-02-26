/**
 * Shared Bun version compatibility helpers.
 *
 * @packageDocumentation
 */

/**
 * Parsed semantic version components.
 */
export interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * Parse a semver-like value into numeric components.
 *
 * Accepts standard versions like `1.3.10` and prerelease variants like
 * `1.3.10-canary.1` by reading only the numeric major/minor/patch prefix.
 */
export function parseSemver(version: string): ParsedSemver | undefined {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return undefined;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

/**
 * Whether a candidate `@types/bun` version is compatible with a target Bun version.
 *
 * Compatibility rule:
 * - same major/minor
 * - candidate patch <= Bun patch
 */
export function isTypesBunVersionCompatible(
  bunVersion: string,
  bunTypesVersion: string
): boolean {
  const parsedBun = parseSemver(bunVersion);
  const parsedTypes = parseSemver(bunTypesVersion);
  if (!parsedBun || !parsedTypes) {
    return bunVersion === bunTypesVersion;
  }

  return (
    parsedBun.major === parsedTypes.major &&
    parsedBun.minor === parsedTypes.minor &&
    parsedTypes.patch <= parsedBun.patch
  );
}
