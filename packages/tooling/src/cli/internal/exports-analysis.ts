/**
 * Pure analysis functions for comparing export maps.
 *
 * Types and stateless comparison logic used by the check-exports command.
 * No filesystem access — all inputs are passed as arguments.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A package.json export map: keys are subpaths, values are export conditions or strings */
export type ExportMap = Record<string, unknown>;

/** Describes drift between expected and actual exports for a single package */
export interface ExportDrift {
  readonly package: string;
  readonly path: string;
  readonly added: string[];
  readonly removed: string[];
  readonly changed: Array<{
    readonly key: string;
    readonly expected: unknown;
    readonly actual: unknown;
  }>;
}

/** Per-package comparison result */
export interface PackageResult {
  readonly name: string;
  readonly status: "ok" | "drift";
  readonly drift?: ExportDrift;
}

/** Aggregated result across all checked packages */
export interface CheckResult {
  readonly ok: boolean;
  readonly packages: PackageResult[];
}

/** Input for comparing a single package's exports */
export interface CompareInput {
  readonly name: string;
  readonly actual: ExportMap;
  readonly expected: ExportMap;
  readonly path?: string;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Convert a source entry file path to its export subpath.
 *
 * @example
 * entryToSubpath("src/index.ts")       // "."
 * entryToSubpath("src/branded.ts")     // "./branded"
 * entryToSubpath("src/cli/index.ts")   // "./cli"
 * entryToSubpath("src/cli/check.ts")   // "./cli/check"
 */
export function entryToSubpath(entry: string): string {
  // Strip src/ prefix and .ts extension
  const stripped = entry.replace(/^src\//, "").replace(/\.[cm]?[jt]sx?$/, "");

  // index at root -> "."
  if (stripped === "index") {
    return ".";
  }

  // dir/index -> ./dir
  if (stripped.endsWith("/index")) {
    return `./${stripped.slice(0, -"/index".length)}`;
  }

  return `./${stripped}`;
}

/**
 * Compare actual vs expected exports for a single package.
 *
 * Returns a PackageResult with status "ok" or "drift" and detailed diff.
 */
export function compareExports(input: CompareInput): PackageResult {
  const { name, actual, expected, path } = input;

  const actualKeys = new Set(Object.keys(actual));
  const expectedKeys = new Set(Object.keys(expected));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{
    readonly key: string;
    readonly expected: unknown;
    readonly actual: unknown;
  }> = [];

  // Keys in expected but not in actual
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) {
      added.push(key);
    }
  }

  // Keys in actual but not in expected
  for (const key of actualKeys) {
    if (!expectedKeys.has(key)) {
      removed.push(key);
    }
  }

  // Keys in both but with different values
  for (const key of actualKeys) {
    if (expectedKeys.has(key)) {
      const actualValue = actual[key];
      const expectedValue = expected[key];
      if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        changed.push({ key, expected: expectedValue, actual: actualValue });
      }
    }
  }

  // Sort for deterministic output
  added.sort();
  removed.sort();
  changed.sort((a, b) => a.key.localeCompare(b.key));

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return { name, status: "ok" };
  }

  return {
    name,
    status: "drift",
    drift: {
      package: name,
      path: path ?? "",
      added,
      removed,
      changed,
    },
  };
}
