/**
 * Types and Zod schemas for TSDoc coverage analysis.
 *
 * @packageDocumentation
 */

import { type ZodType, z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Coverage classification for a single declaration. */
export type CoverageLevel = "documented" | "partial" | "undocumented";

/** Result for a single exported declaration. */
export interface DeclarationCoverage {
  readonly name: string;
  readonly kind: string;
  readonly level: CoverageLevel;
  readonly file: string;
  readonly line: number;
}

/** Coverage summary statistics. */
export interface CoverageSummary {
  readonly documented: number;
  readonly partial: number;
  readonly undocumented: number;
  readonly total: number;
  readonly percentage: number;
}

/** Per-package TSDoc coverage stats. */
export interface PackageCoverage {
  readonly name: string;
  readonly path: string;
  readonly declarations: readonly DeclarationCoverage[];
  readonly documented: number;
  readonly partial: number;
  readonly undocumented: number;
  readonly total: number;
  readonly percentage: number;
}

/** Aggregated result across all packages. */
export interface TsDocCheckResult {
  readonly ok: boolean;
  readonly packages: readonly PackageCoverage[];
  readonly summary: CoverageSummary;
}

// ---------------------------------------------------------------------------
// Zod schemas (for action output validation / schema introspection)
// ---------------------------------------------------------------------------

/** Zod schema for {@link CoverageLevel}. */
export const coverageLevelSchema: ZodType<CoverageLevel> = z.enum([
  "documented",
  "partial",
  "undocumented",
]);

/** Zod schema for {@link DeclarationCoverage}. */
export const declarationCoverageSchema: ZodType<DeclarationCoverage> = z.object(
  {
    name: z.string(),
    kind: z.string(),
    level: coverageLevelSchema,
    file: z.string(),
    line: z.number(),
  }
);

/** Zod schema for {@link CoverageSummary}. */
export const coverageSummarySchema: ZodType<CoverageSummary> = z.object({
  documented: z.number(),
  partial: z.number(),
  undocumented: z.number(),
  total: z.number(),
  percentage: z.number(),
});

/** Zod schema for {@link PackageCoverage}. */
export const packageCoverageSchema: ZodType<PackageCoverage> = z.object({
  name: z.string(),
  path: z.string(),
  declarations: z.array(declarationCoverageSchema),
  documented: z.number(),
  partial: z.number(),
  undocumented: z.number(),
  total: z.number(),
  percentage: z.number(),
});

/** Zod schema for {@link TsDocCheckResult}. */
export const tsDocCheckResultSchema: ZodType<TsDocCheckResult> = z.object({
  ok: z.boolean(),
  packages: z.array(packageCoverageSchema),
  summary: coverageSummarySchema,
});

/** Options for the check-tsdoc command. */
export interface CheckTsDocOptions {
  readonly strict?: boolean | undefined;
  readonly json?: boolean | undefined;
  readonly minCoverage?: number | undefined;
  readonly cwd?: string | undefined;
  readonly paths?: readonly string[] | undefined;
}
