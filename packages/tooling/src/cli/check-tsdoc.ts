/**
 * Check-tsdoc command -- validates TSDoc coverage on exported declarations.
 *
 * Pure core functions for analyzing TSDoc coverage across monorepo packages.
 * The CLI runner in {@link runCheckTsdoc} handles filesystem discovery and output.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Re-exports: types
// ---------------------------------------------------------------------------

export type {
  CheckTsDocOptions,
  CoverageLevel,
  CoverageSummary,
  DeclarationCoverage,
  PackageCoverage,
  TsDocCheckResult,
} from "./internal/tsdoc-types.js";

// ---------------------------------------------------------------------------
// Re-exports: Zod schemas
// ---------------------------------------------------------------------------

export {
  coverageLevelSchema,
  coverageSummarySchema,
  declarationCoverageSchema,
  packageCoverageSchema,
  tsDocCheckResultSchema,
} from "./internal/tsdoc-types.js";

// ---------------------------------------------------------------------------
// Re-exports: analysis functions
// ---------------------------------------------------------------------------

export {
  analyzeCheckTsdoc,
  analyzeSourceFile,
  calculateCoverage,
  classifyDeclaration,
  getDeclarationKind,
  getDeclarationName,
  isExportedDeclaration,
} from "./internal/tsdoc-analysis.js";

// ---------------------------------------------------------------------------
// Re-exports: formatting
// ---------------------------------------------------------------------------

export {
  printCheckTsdocHuman,
  resolveJsonMode,
} from "./internal/tsdoc-formatting.js";

// ---------------------------------------------------------------------------
// Runner (inline -- orchestrates analysis + formatting)
// ---------------------------------------------------------------------------

import { analyzeCheckTsdoc } from "./internal/tsdoc-analysis.js";
import {
  printCheckTsdocHuman,
  resolveJsonMode,
} from "./internal/tsdoc-formatting.js";
import type { CheckTsDocOptions } from "./internal/tsdoc-types.js";

/**
 * Run check-tsdoc across workspace packages.
 *
 * Discovers packages with `src/index.ts` entry points, analyzes TSDoc
 * coverage on exported declarations, and reports per-package statistics.
 * Calls `process.exit()` on completion.
 */
export async function runCheckTsdoc(
  options: CheckTsDocOptions = {}
): Promise<void> {
  const result = analyzeCheckTsdoc(options);

  if (!result) {
    process.stderr.write(
      "No packages found with src/index.ts entry points.\n" +
        "Searched: packages/*/src/index.ts, apps/*/src/index.ts, src/index.ts\n" +
        "Use --package <path> to specify a package path explicitly.\n"
    );
    process.exitCode = 1;
    return;
  }

  if (resolveJsonMode(options)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printCheckTsdocHuman(result, {
      strict: options.strict,
      minCoverage: options.minCoverage,
    });
  }

  process.exitCode = result.ok ? 0 : 1;
}
