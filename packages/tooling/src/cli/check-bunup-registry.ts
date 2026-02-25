/**
 * Check-bunup-registry command — validates all packages with `bunup --filter`
 * build scripts are registered in bunup.config.ts.
 *
 * Prevents silent build failures where `bunup --filter <name>` silently exits 0
 * with no output when the package isn't in the workspace config.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of checking bunup workspace registration */
export interface RegistryCheckResult {
  readonly ok: boolean;
  readonly missing: string[];
}

/** Bunup workspace entry (minimal shape for name extraction) */
interface WorkspaceEntry {
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Extract the package name from a build script containing `bunup --filter`.
 *
 * @example
 * extractBunupFilterName("bunup --filter @outfitter/logging")
 * // => "@outfitter/logging"
 *
 * extractBunupFilterName("cd ../.. && bunup --filter @outfitter/types")
 * // => "@outfitter/types"
 *
 * extractBunupFilterName("tsc --noEmit")
 * // => null
 */
export function extractBunupFilterName(script: string): string | null {
  const match = script.match(/bunup\s+--filter\s+(\S+)/);
  return match?.[1] ?? null;
}

/**
 * Find packages that have `bunup --filter` build scripts but are not
 * registered in the bunup workspace config.
 *
 * @param packagesWithFilter - Package names that have `bunup --filter` in their build script
 * @param registeredNames - Package names registered in bunup.config.ts
 * @returns Result with sorted list of missing packages
 */
export function findUnregisteredPackages(
  packagesWithFilter: string[],
  registeredNames: string[]
): RegistryCheckResult {
  const registered = new Set(registeredNames);
  const missing = packagesWithFilter
    .filter((name) => !registered.has(name))
    .toSorted();

  return {
    ok: missing.length === 0,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run bunup registry check across all workspace packages.
 *
 * Scans packages/&#42;/package.json for build scripts containing `bunup --filter`,
 * then verifies each is registered in bunup.config.ts.
 */
export async function runCheckBunupRegistry(): Promise<void> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, "bunup.config.ts");

  // Load bunup workspace config to get registered names
  let registeredNames: string[];
  try {
    const configModule = await import(configPath);
    const rawConfig: unknown = configModule.default;
    if (!Array.isArray(rawConfig)) {
      process.stderr.write("bunup.config.ts must export a workspace array\n");
      process.exit(1);
    }
    registeredNames = (rawConfig as WorkspaceEntry[]).map(
      (entry) => entry.name
    );
  } catch {
    process.stderr.write(`Could not load bunup.config.ts from ${cwd}\n`);
    process.exit(1);
  }

  // Scan packages/*/package.json and apps/*/package.json for bunup --filter build scripts
  const packagesWithFilter: string[] = [];
  const glob = new Bun.Glob("{packages,apps}/*/package.json");

  for (const match of glob.scanSync({ cwd })) {
    const pkgPath = resolve(cwd, match);
    try {
      const pkg = (await Bun.file(pkgPath).json()) as {
        name?: string;
        scripts?: Record<string, string>;
      };
      const buildScript = pkg.scripts?.["build"];
      if (!buildScript) continue;

      const filterName = extractBunupFilterName(buildScript);
      if (filterName) {
        packagesWithFilter.push(filterName);
      }
    } catch {
      // Skip unreadable package.json files
    }
  }

  const result = findUnregisteredPackages(packagesWithFilter, registeredNames);

  if (result.ok) {
    process.stdout.write(
      `${COLORS.green}All ${packagesWithFilter.length} packages with bunup --filter are registered in bunup.config.ts.${COLORS.reset}\n`
    );
    process.exit(0);
  }

  process.stderr.write(
    `${COLORS.red}${result.missing.length} package(s) have bunup --filter build scripts but are not registered in bunup.config.ts:${COLORS.reset}\n\n`
  );

  for (const name of result.missing) {
    process.stderr.write(
      `  ${COLORS.yellow}${name}${COLORS.reset}  ${COLORS.dim}(missing from workspace array)${COLORS.reset}\n`
    );
  }

  process.stderr.write(
    `\nAdd the missing entries to ${COLORS.blue}bunup.config.ts${COLORS.reset} defineWorkspace array.\n`
  );
  process.stderr.write(
    `Without registration, ${COLORS.dim}bunup --filter <name>${COLORS.reset} silently exits with no output.\n`
  );

  process.exit(1);
}
