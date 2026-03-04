/**
 * Input parsing utilities for CLI commands.
 *
 * These utilities handle common input patterns like multi-ID collection,
 * file expansion, glob patterns, and various value parsing.
 *
 * @packageDocumentation
 */

import { ValidationError } from "@outfitter/contracts";
import { Err, Ok, type Result } from "better-result";

import type { NormalizeIdOptions } from "./types.js";

// =============================================================================
// Re-exports from internal modules
// =============================================================================

export { collectIds } from "./internal/input-normalization.js";
export {
  expandFileArg,
  parseFilter,
  parseGlob,
  parseKeyValue,
  parseRange,
  parseSortSpec,
} from "./internal/input-parsers.js";

// =============================================================================
// normalizeId() — kept inline to avoid pure-re-export barrel (bunup compat)
// =============================================================================

/**
 * Normalize an identifier (trim, lowercase where appropriate).
 *
 * @param input - Raw identifier input
 * @param options - Normalization options
 * @returns Normalized identifier
 *
 * @example
 * ```typescript
 * normalizeId("  MY-ID  ", { lowercase: true, trim: true });
 * // => Result<"my-id", ValidationError>
 * ```
 */
export function normalizeId(
  input: string,
  options?: NormalizeIdOptions
): Result<string, InstanceType<typeof ValidationError>> {
  const {
    trim = false,
    lowercase = false,
    minLength,
    maxLength,
    pattern,
  } = options ?? {};

  let normalized = input;

  if (trim) {
    normalized = normalized.trim();
  }

  if (lowercase) {
    normalized = normalized.toLowerCase();
  }

  // Validate length constraints
  if (minLength !== undefined && normalized.length < minLength) {
    return new Err(
      new ValidationError({
        message: `ID must be at least ${minLength} characters long`,
        field: "id",
      })
    );
  }

  if (maxLength !== undefined && normalized.length > maxLength) {
    return new Err(
      new ValidationError({
        message: `ID must be at most ${maxLength} characters long`,
        field: "id",
      })
    );
  }

  // Validate pattern
  if (pattern && !pattern.test(normalized)) {
    return new Err(
      new ValidationError({
        message: `ID does not match required pattern: ${pattern.source}`,
        field: "id",
      })
    );
  }

  return new Ok(normalized);
}
