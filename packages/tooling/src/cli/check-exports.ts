/**
 * Check-exports command — validates package.json exports are in sync with source.
 *
 * Pure core functions for comparing export maps. The CLI runner in
 * {@link runCheckExports} handles filesystem discovery and output.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

// Re-export public API from internal modules
export { entryToSubpath, compareExports } from "./internal/exports-analysis.js";

export type {
  ExportMap,
  ExportDrift,
  PackageResult,
  CheckResult,
  CompareInput,
} from "./internal/exports-analysis.js";

import type {
  ExportMap,
  PackageResult,
  CheckResult,
} from "./internal/exports-analysis.js";
import { compareExports } from "./internal/exports-analysis.js";
import {
  computeExpectedExports,
  type WorkspaceEntry,
} from "./internal/exports-fs.js";

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

/** Options for the check-exports command */
export interface CheckExportsOptions {
  readonly json?: boolean;
}

/** Resolve whether to output JSON based on options and env */
export function resolveJsonMode(options: CheckExportsOptions = {}): boolean {
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-based feature detection
  return options.json ?? process.env["OUTFITTER_JSON"] === "1";
}

/**
 * Run check-exports across all workspace packages.
 *
 * Reads the bunup workspace config to discover packages and their export
 * settings, then compares expected vs actual exports in each package.json.
 */
export async function runCheckExports(
  options: CheckExportsOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const configPath = resolve(cwd, "bunup.config.ts");

  let workspaces: WorkspaceEntry[];
  try {
    const configModule = await import(configPath);
    const rawConfig: unknown = configModule.default;
    if (!Array.isArray(rawConfig)) {
      process.stderr.write("bunup.config.ts must export a workspace array\n");
      process.exitCode = 1;
      return;
    }
    workspaces = rawConfig as WorkspaceEntry[];
  } catch {
    process.stderr.write(`Could not load bunup.config.ts from ${cwd}\n`);
    process.exitCode = 1;
    return;
  }

  const results: PackageResult[] = [];

  for (const workspace of workspaces) {
    const packageRoot = resolve(cwd, workspace.root);
    const pkgPath = resolve(packageRoot, "package.json");

    let pkg: { name?: string; exports?: ExportMap; files?: string[] };
    try {
      pkg = await Bun.file(pkgPath).json();
    } catch {
      results.push({ name: workspace.name, status: "ok" });
      continue;
    }

    const actual: ExportMap =
      typeof pkg.exports === "object" && pkg.exports !== null
        ? (pkg.exports as ExportMap)
        : {};
    const expected = computeExpectedExports(packageRoot, workspace, pkg);

    results.push(
      compareExports({
        name: workspace.name,
        actual,
        expected,
        path: workspace.root,
      })
    );
  }

  const checkResult: CheckResult = {
    ok: results.every((r) => r.status === "ok"),
    packages: results,
  };

  if (resolveJsonMode(options)) {
    process.stdout.write(`${JSON.stringify(checkResult, null, 2)}\n`);
  } else {
    const drifted = results.filter((r) => r.status === "drift");

    if (drifted.length === 0) {
      process.stdout.write(
        `${COLORS.green}All ${results.length} packages have exports in sync.${COLORS.reset}\n`
      );
    } else {
      process.stderr.write(
        `${COLORS.red}Export drift detected in ${drifted.length} package(s):${COLORS.reset}\n\n`
      );

      for (const result of drifted) {
        const drift = result.drift;
        if (!drift) continue;

        process.stderr.write(
          `  ${COLORS.yellow}${result.name}${COLORS.reset} ${COLORS.dim}(${drift.path})${COLORS.reset}\n`
        );

        for (const key of drift.added) {
          process.stderr.write(
            `    ${COLORS.green}+ ${key}${COLORS.reset}  ${COLORS.dim}(missing from package.json)${COLORS.reset}\n`
          );
        }
        for (const key of drift.removed) {
          process.stderr.write(
            `    ${COLORS.red}- ${key}${COLORS.reset}  ${COLORS.dim}(not in source)${COLORS.reset}\n`
          );
        }
        for (const entry of drift.changed) {
          process.stderr.write(
            `    ${COLORS.yellow}~ ${entry.key}${COLORS.reset}  ${COLORS.dim}(value mismatch)${COLORS.reset}\n`
          );
        }
        process.stderr.write("\n");
      }

      process.stderr.write(
        `Run ${COLORS.blue}bun run build${COLORS.reset} to regenerate exports.\n`
      );
    }
  }

  process.exitCode = checkResult.ok ? 0 : 1;
}
