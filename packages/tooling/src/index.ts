/**
 * @outfitter/tooling
 *
 * Dev tooling configuration presets for Outfitter projects.
 * Provides standardized oxlint/oxfmt, TypeScript, lefthook, and markdownlint configurations.
 *
 * @example
 * ```json
 * // .oxlintrc.json — extend the Outfitter preset
 * {
 *   "extends": ["ultracite/oxlint/core"]
 * }
 * ```
 *
 * @example
 * ```json
 * // tsconfig.json
 * {
 *   "extends": "@outfitter/tooling/tsconfig.preset.bun.json"
 * }
 * ```
 *
 * @example
 * ```yaml
 * # .lefthook.yml
 * extends:
 *   - node_modules/@outfitter/tooling/lefthook.yml
 * ```
 *
 * @packageDocumentation
 */

// Re-export check-tsdoc analysis functions and schemas
export type {
  CheckTsDocOptions,
  CoverageLevel,
  DeclarationCoverage,
  PackageCoverage,
  TsDocCheckResult,
} from "./cli/check-tsdoc.js";
export {
  analyzeCheckTsdoc,
  coverageLevelSchema,
  declarationCoverageSchema,
  packageCoverageSchema,
  printCheckTsdocHuman,
  tsDocCheckResultSchema,
} from "./cli/check-tsdoc.js";
// Re-export shared Bun version compatibility helpers
export type { ParsedSemver } from "./bun-version-compat.js";
export {
  isTypesBunVersionCompatible,
  parseSemver,
} from "./bun-version-compat.js";
// Re-export registry types for convenience
export type {
  AddBlockOptions,
  AddBlockResult,
  Block,
  BlockDefinition,
  FileEntry,
  Registry,
  RegistryBuildConfig,
} from "./registry/index.js";
export {
  BlockSchema,
  FileEntrySchema,
  RegistrySchema,
} from "./registry/index.js";
/** Package version, read dynamically from package.json. */
export { VERSION } from "./version.js";
