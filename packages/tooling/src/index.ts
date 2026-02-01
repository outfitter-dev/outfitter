/**
 * @outfitter/tooling
 *
 * Dev tooling configuration presets for Outfitter projects.
 * Provides standardized biome, TypeScript, and lefthook configurations.
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
