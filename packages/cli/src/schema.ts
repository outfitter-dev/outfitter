/**
 * Schema introspection for CLI commands.
 *
 * Provides Commander integration and human-readable formatting on top of
 * `@outfitter/schema` manifest generation. Surface map subcommands
 * (generate, diff) are opt-in via `SchemaCommandOptions.surface`.
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/** Options for surface map subcommands (generate, diff). */
export interface SurfaceCommandOptions {
  readonly cwd?: string;
  readonly outputDir?: string;
}

/** Options for the schema Commander command. */
export interface SchemaCommandOptions {
  readonly programName?: string;
  readonly surface?: SurfaceCommandOptions;
}

// =============================================================================
// Re-exports from @outfitter/schema (backward compatibility)
// =============================================================================

// Re-export manifest types for backward compatibility
export type {
  ActionManifest,
  ActionManifestEntry,
  ActionSource,
  GenerateManifestOptions,
} from "@outfitter/schema";

// eslint-disable-next-line oxc/no-barrel-file -- not a barrel — re-exports for backward compat alongside local exports
export { generateManifest } from "@outfitter/schema";

// =============================================================================
// Re-exports from internal modules
// =============================================================================

export { formatManifestHuman } from "./internal/schema-formatting.js";
export { createSchemaCommand } from "./internal/schema-commands.js";
