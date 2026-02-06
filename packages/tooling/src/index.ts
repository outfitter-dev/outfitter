/**
 * @outfitter/tooling
 *
 * Dev tooling configuration presets for Outfitter projects.
 * Provides standardized biome, TypeScript, lefthook, and markdownlint configurations.
 *
 * @example
 * ```json
 * // biome.json
 * {
 *   "extends": ["ultracite/biome/core", "@outfitter/tooling/biome.json"]
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

/** Package version */
export const VERSION = "0.1.0-rc.1";

// Re-export registry types for convenience
export type {
	FileEntry,
	Block,
	Registry,
	BlockDefinition,
	RegistryBuildConfig,
	AddBlockResult,
	AddBlockOptions,
} from "./registry/index.js";

export {
	FileEntrySchema,
	BlockSchema,
	RegistrySchema,
} from "./registry/index.js";
