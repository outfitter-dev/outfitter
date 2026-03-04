/**
 * Validation and resource error classes.
 *
 * Includes errors for input validation, ambiguous matches, assertions,
 * not-found resources, already-exists conflicts, and general conflicts.
 *
 * @internal
 */

import {
  AlreadyExistsErrorBase,
  AmbiguousErrorBase,
  AssertionErrorBase,
  ConflictErrorBase,
  NotFoundErrorBase,
  ValidationErrorBase,
} from "./error-base.js";
import { getExitCode, getStatusCode } from "./error-taxonomy.js";

// ---------------------------------------------------------------------------
// Concrete error classes — validation and resource errors
// ---------------------------------------------------------------------------

/**
 * Input validation failed.
 *
 * @example
 * ```typescript
 * new ValidationError({ message: "Email format invalid", field: "email" });
 * new ValidationError({
 *   message: "Value out of range",
 *   field: "age",
 *   context: { min: 0, max: 150, received: -1 },
 * });
 * ```
 */
export class ValidationError extends ValidationErrorBase {
  readonly category = "validation" as const;

  /** Create a ValidationError with auto-generated message from field name. */
  static create(
    field: string,
    reason: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError({
      message: `${field}: ${reason}`,
      field,
      ...(context != null && { context }),
    });
  }

  /**
   * Create a freeform ValidationError without a specific field.
   *
   * Use when the validation failure applies to the input as a whole
   * rather than a single field (e.g., "Invalid pipeline configuration").
   *
   * @param message - Human-readable validation error message
   * @param context - Optional structured context for debugging
   */
  static fromMessage(
    message: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError({
      message,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Multiple matches found — user must disambiguate.
 *
 * Used in search/resolution systems where partial input matches
 * multiple candidates. Carries the candidate list so transport
 * layers can prompt disambiguation.
 *
 * @example
 * ```typescript
 * new AmbiguousError({
 *   message: "Multiple headings match 'Intro'",
 *   candidates: ["Introduction", "Intro to APIs"],
 * });
 * AmbiguousError.create("heading", ["Introduction", "Intro to APIs"]);
 * ```
 */
export class AmbiguousError extends AmbiguousErrorBase {
  readonly category = "validation" as const;

  /** Create an AmbiguousError with auto-generated message. */
  static create(
    what: string,
    candidates: string[],
    context?: Record<string, unknown>
  ): AmbiguousError {
    return new AmbiguousError({
      message: `Ambiguous ${what}: ${candidates.length} matches found`,
      candidates,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Assertion failed (invariant violation).
 *
 * Used by assertion utilities that return Result types instead of throwing.
 * AssertionError indicates a programming bug — an invariant that should
 * never be violated was broken. These are internal errors, not user input
 * validation failures.
 *
 * **Category rationale**: Uses `internal` (not `validation`) because:
 * - Assertions check **invariants** (programmer assumptions), not user input
 * - A failed assertion means "this should be impossible if the code is correct"
 * - User-facing validation uses {@link ValidationError} with helpful field info
 * - HTTP 500 is correct: this is a server bug, not a client mistake
 *
 * @example
 * ```typescript
 * // In domain logic after validation has passed
 * const result = assertDefined(cachedValue, "Cache should always have value after init");
 * if (result.isErr()) {
 *   return result; // Propagate as internal error
 * }
 * ```
 *
 * @see ValidationError - For user input validation failures (HTTP 400)
 */
export class AssertionError extends AssertionErrorBase {
  readonly category = "internal" as const;

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Requested resource not found.
 *
 * @example
 * ```typescript
 * new NotFoundError({ message: "note not found: abc123", resourceType: "note", resourceId: "abc123" });
 * new NotFoundError({
 *   message: "Heading not found",
 *   resourceType: "heading",
 *   resourceId: "h:Intro",
 *   context: { availableHeadings: ["Introduction", "Getting Started"] },
 * });
 * ```
 */
export class NotFoundError extends NotFoundErrorBase {
  readonly category = "not_found" as const;

  /** Create a NotFoundError with auto-generated message. */
  static create(
    resourceType: string,
    resourceId: string,
    context?: Record<string, unknown>
  ): NotFoundError {
    return new NotFoundError({
      message: `${resourceType} not found: ${resourceId}`,
      resourceType,
      resourceId,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Resource already exists — the inverse of {@link NotFoundError}.
 *
 * Use when a create/write operation fails because the target resource
 * is already present. Carries `resourceType` and `resourceId` to identify
 * what already exists, mirroring {@link NotFoundError}'s structure.
 *
 * Maps to HTTP 409 (Conflict) and exit code 3.
 *
 * @example
 * ```typescript
 * new AlreadyExistsError({
 *   message: "File already exists: notes/meeting.md",
 *   resourceType: "file",
 *   resourceId: "notes/meeting.md",
 * });
 * AlreadyExistsError.create("file", "notes/meeting.md");
 * ```
 *
 * @see ConflictError - For general state conflicts (version mismatch, concurrent modification)
 * @see NotFoundError - The inverse: resource does not exist
 */
export class AlreadyExistsError extends AlreadyExistsErrorBase {
  readonly category = "conflict" as const;

  /** Create an AlreadyExistsError with auto-generated message. */
  static create(
    resourceType: string,
    resourceId: string,
    context?: Record<string, unknown>
  ): AlreadyExistsError {
    return new AlreadyExistsError({
      message: `${resourceType} already exists: ${resourceId}`,
      resourceType,
      resourceId,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * State conflict (version mismatch, concurrent modification).
 *
 * Use for general conflicts that don't fit {@link AlreadyExistsError}:
 * optimistic locking failures, concurrent writes, ETag mismatches,
 * or any case where the operation can't proceed due to state divergence.
 *
 * Maps to HTTP 409 (Conflict) and exit code 3.
 *
 * **Choosing the right conflict error:**
 * - Resource already exists? Use {@link AlreadyExistsError}
 * - Version/ETag mismatch? Use {@link ConflictError}
 * - Concurrent modification detected? Use {@link ConflictError}
 *
 * @example
 * ```typescript
 * new ConflictError({ message: "Resource was modified by another process" });
 * ConflictError.create("ETag mismatch: expected abc, got def");
 * ```
 *
 * @see AlreadyExistsError - For "resource already exists" specifically
 */
export class ConflictError extends ConflictErrorBase {
  readonly category = "conflict" as const;

  /** Create a ConflictError with optional context. */
  static create(
    message: string,
    context?: Record<string, unknown>
  ): ConflictError {
    return new ConflictError({ message, ...(context != null && { context }) });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}
