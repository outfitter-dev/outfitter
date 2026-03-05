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
// Types (re-exported from internal)
// =============================================================================

export type {
  SchemaCommandOptions,
  SurfaceCommandOptions,
} from "./internal/schema-types.js";

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

// oxlint-disable-next-line oxc/no-barrel-file -- not a barrel — re-exports for backward compat alongside local exports
export { generateManifest } from "@outfitter/schema";

// =============================================================================
// Re-exports from internal modules
// =============================================================================

export { formatManifestHuman } from "./internal/schema-formatting.js";
export { createSchemaCommand } from "./internal/schema-commands.js";
