/**
 * Docs map schema and document kind taxonomy.
 *
 * Defines the structure of the `.outfitter/docs-map.json` manifest
 * that catalogs all documentation in a project. Validated at runtime
 * with Zod; types are inferred from schemas.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// =============================================================================
// Document Kind Taxonomy
// =============================================================================

/**
 * Document kind taxonomy classifying documentation by purpose.
 *
 * @example
 * ```typescript
 * const kind = DocKindSchema.parse("guide"); // "guide"
 * ```
 */
const docKindValues = [
  "readme",
  "guide",
  "reference",
  "architecture",
  "release",
  "convention",
  "deep",
  "generated",
] as const;

/** Document kind discriminator. */
export type DocKind = (typeof docKindValues)[number];

export const DocKindSchema: z.ZodType<DocKind> = z.enum(docKindValues);

// =============================================================================
// Docs Map Entry
// =============================================================================

/**
 * Individual doc entry in the docs map.
 *
 * Each entry represents a single documentation file with its classification,
 * source location, and output destination.
 *
 * @example
 * ```typescript
 * const entry = DocsMapEntrySchema.parse({
 *   id: "cli/README.md",
 *   kind: "readme",
 *   title: "CLI Package",
 *   sourcePath: "packages/cli/README.md",
 *   outputPath: "docs/packages/cli/README.md",
 *   package: "@outfitter/cli",
 * });
 * ```
 */
export const DocsMapEntrySchema: z.ZodObject<{
  id: z.ZodString;
  kind: typeof DocKindSchema;
  title: z.ZodString;
  sourcePath: z.ZodString;
  outputPath: z.ZodString;
  package: z.ZodOptional<z.ZodString>;
  tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
}> = z.object({
  /** Unique identifier (e.g. "cli/README.md"). */
  id: z.string(),
  /** Document kind from the taxonomy. */
  kind: DocKindSchema,
  /** First heading or filename used as display title. */
  title: z.string(),
  /** Source file path relative to workspace root. */
  sourcePath: z.string(),
  /** Output file path relative to workspace root. */
  outputPath: z.string(),
  /** Owning package name, if the doc belongs to a package. */
  package: z.string().optional(),
  /** Freeform classification tags. */
  tags: z.array(z.string()).default([]),
});

/** A single documentation entry in the docs map. */
export type DocsMapEntry = z.infer<typeof DocsMapEntrySchema>;

// =============================================================================
// Docs Map Manifest
// =============================================================================

/**
 * Top-level docs map manifest written to `.outfitter/docs-map.json`.
 *
 * Contains metadata about the generation run and an array of all
 * documentation entries discovered in the workspace.
 *
 * @example
 * ```typescript
 * const map = DocsMapSchema.parse({
 *   generatedAt: new Date().toISOString(),
 *   generator: "@outfitter/docs@0.1.2",
 *   entries: [],
 * });
 * ```
 */
export const DocsMapSchema: z.ZodObject<{
  $schema: z.ZodOptional<z.ZodString>;
  generatedAt: z.ZodString;
  generator: z.ZodString;
  entries: z.ZodArray<typeof DocsMapEntrySchema>;
}> = z.object({
  /** Optional JSON Schema URI for editor validation. */
  $schema: z.string().optional(),
  /** ISO-8601 timestamp of when the map was generated. */
  generatedAt: z.string().datetime(),
  /** Generator identifier including package version. */
  generator: z.string(),
  /** All documentation entries in the workspace. */
  entries: z.array(DocsMapEntrySchema),
});

/** The full docs map manifest shape. */
export type DocsMap = z.infer<typeof DocsMapSchema>;
