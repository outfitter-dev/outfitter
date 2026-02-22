/**
 * Shared type definitions for docs commands.
 *
 * @packageDocumentation
 */

/**
 * Local shape matching DocsMapEntry from "@outfitter/docs".
 *
 * Defined separately because the dist types use z.infer which tsc
 * cannot fully resolve through the bundled declarations.
 */
export interface DocsMapEntryShape {
  readonly id: string;
  readonly kind: string;
  readonly outputPath: string;
  readonly package?: string;
  readonly sourcePath: string;
  readonly tags: string[];
  readonly title: string;
}
