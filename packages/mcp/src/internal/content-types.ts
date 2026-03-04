/**
 * Shared content type definitions used across prompt and resource types.
 *
 * @internal
 */

// ============================================================================
// Content Annotations
// ============================================================================

/**
 * Annotations for content items (resource content, prompt messages).
 *
 * Provides hints about content audience and priority.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/annotations/
 */
export interface ContentAnnotations {
  /**
   * Who the content is intended for.
   * Can include "user", "assistant", or both.
   */
  audience?: Array<"user" | "assistant">;

  /**
   * Priority level from 0.0 (least) to 1.0 (most important).
   */
  priority?: number;
}
