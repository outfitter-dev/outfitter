/**
 * Error wrapping utilities for normalizing unknown errors into typed OutfitterErrors.
 *
 * Two-step behavior:
 * 1. Typed Outfitter errors (with `category`) pass through unchanged — same reference, mapper NOT called.
 * 2. Untyped errors go through optional mapper. Without mapper (or unmatched), wraps as InternalError.
 *
 * @module wrap-error
 */
import type { ErrorCategory } from "./errors.js";
import { InternalError } from "./errors.js";
import type { OutfitterError } from "./errors.js";

/**
 * An error mapper converts an unknown error into a typed OutfitterError.
 *
 * Return `undefined` if the mapper does not handle this error (pass to next mapper or default).
 */
export type ErrorMapper = (error: unknown) => OutfitterError | undefined;

/**
 * Type guard: checks whether `value` is a typed Outfitter error (has a `category` field
 * matching a known {@link ErrorCategory}).
 */
export function isOutfitterError(value: unknown): value is OutfitterError {
  if (!(value instanceof Error)) {
    return false;
  }

  const candidate = value as unknown as Record<string, unknown>;
  return (
    typeof candidate["category"] === "string" &&
    typeof candidate["message"] === "string" &&
    typeof candidate["_tag"] === "string" &&
    isErrorCategory(candidate["category"])
  );
}

const ERROR_CATEGORIES: ReadonlySet<string> = new Set<ErrorCategory>([
  "validation",
  "not_found",
  "conflict",
  "permission",
  "timeout",
  "rate_limit",
  "network",
  "internal",
  "auth",
  "cancelled",
]);

function isErrorCategory(value: string): value is ErrorCategory {
  return ERROR_CATEGORIES.has(value);
}

/**
 * Extract a human-readable message from an unknown error value.
 */
function extractMessage(error: unknown): string {
  if (typeof error === "string") {
    return error || "Unknown error";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error != null && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>)["message"]);
  }
  return "Unknown error";
}

/**
 * Normalize an unknown error into a typed OutfitterError.
 *
 * - Typed Outfitter errors pass through unchanged (same reference, mapper NOT called).
 * - Untyped errors go through optional mapper.
 * - Without mapper or when mapper returns `undefined`, wraps as {@link InternalError}.
 * - Plain strings are wrapped as InternalError with the string as message.
 *
 * @param error - The unknown error to normalize
 * @param mapper - Optional mapper to convert untyped errors into typed OutfitterErrors
 * @returns A typed OutfitterError
 *
 * @example
 * ```typescript
 * // Typed errors pass through
 * const typed = new ValidationError({ message: "bad input" });
 * wrapError(typed) === typed; // true — same reference
 *
 * // Untyped errors go through mapper
 * const mapper: ErrorMapper = (err) => {
 *   if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
 *     return new NetworkError({ message: err.message });
 *   }
 *   return undefined;
 * };
 * wrapError(new Error("ECONNREFUSED"), mapper); // NetworkError
 *
 * // Unmatched errors become InternalError
 * wrapError(new Error("unknown")); // InternalError
 *
 * // Strings become InternalError with message
 * wrapError("something failed"); // InternalError { message: "something failed" }
 * ```
 */
export function wrapError(
  error: unknown,
  mapper?: ErrorMapper
): OutfitterError {
  // Step 1: typed Outfitter errors pass through unchanged
  if (isOutfitterError(error)) {
    return error;
  }

  // Step 2: untyped errors go through optional mapper
  if (mapper != null) {
    const mapped = mapper(error);
    if (mapped != null) {
      return mapped;
    }
  }

  // Default: wrap as InternalError
  const message = extractMessage(error);
  return new InternalError({ message });
}

/**
 * Compose multiple error mappers into a single mapper.
 *
 * Mappers run in declared order and short-circuit on the first match
 * (first mapper to return a non-`undefined` value wins).
 *
 * @param mappers - Error mappers to compose
 * @returns A single composed error mapper
 *
 * @example
 * ```typescript
 * const networkMapper: ErrorMapper = (err) => {
 *   if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
 *     return new NetworkError({ message: err.message });
 *   }
 *   return undefined;
 * };
 * const timeoutMapper: ErrorMapper = (err) => {
 *   if (err instanceof Error && err.message.includes("ETIMEDOUT")) {
 *     return TimeoutError.create("request", 5000);
 *   }
 *   return undefined;
 * };
 *
 * const composed = composeMappers(networkMapper, timeoutMapper);
 * wrapError(new Error("ECONNREFUSED"), composed); // NetworkError
 * ```
 */
export function composeMappers(...mappers: ErrorMapper[]): ErrorMapper {
  return (error: unknown): OutfitterError | undefined => {
    for (const mapper of mappers) {
      const result = mapper(error);
      if (result != null) {
        return result;
      }
    }
    return undefined;
  };
}
