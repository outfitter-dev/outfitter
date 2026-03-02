/**
 * HTTP Response-to-Result helper.
 *
 * Maps HTTP status codes to error categories per the Outfitter error taxonomy.
 *
 * @module from-fetch
 */
import { Result } from "better-result";

import type { ErrorCategory, OutfitterError } from "./errors.js";
import {
  AuthError,
  ConflictError,
  InternalError,
  NetworkError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "./errors.js";

/**
 * Maps specific HTTP status codes to error categories.
 *
 * Unmapped 4xx codes fall back to `validation`, unmapped 5xx to `internal`.
 */
const httpStatusToCategory: Readonly<Record<number, ErrorCategory>> = {
  401: "auth",
  403: "permission",
  404: "not_found",
  408: "timeout",
  409: "conflict",
  429: "rate_limit",
  502: "network",
  503: "network",
  504: "timeout",
};

/**
 * Create a typed OutfitterError from an HTTP status code and status text.
 */
function createErrorForCategory(
  category: ErrorCategory,
  status: number,
  statusText: string,
  retryAfterSeconds?: number
): OutfitterError {
  const message = `HTTP ${status}${statusText ? `: ${statusText}` : ""}`;

  switch (category) {
    case "auth":
      return AuthError.create(message);
    case "permission":
      return PermissionError.create(message);
    case "not_found":
      return new NotFoundError({
        message,
        resourceType: "resource",
        resourceId: `HTTP ${status}`,
        ...(statusText ? { context: { statusText } } : {}),
      });
    case "timeout":
      return new TimeoutError({
        message,
        operation: "HTTP request",
        timeoutMs: 0,
      });
    case "rate_limit":
      return RateLimitError.create(message, retryAfterSeconds);
    case "network":
      return NetworkError.create(message);
    case "conflict":
      return ConflictError.create(message);
    case "validation":
      return ValidationError.fromMessage(message);
    case "internal":
      return InternalError.create(message);
    case "cancelled":
      return InternalError.create(message);
  }
}

/**
 * Parse Retry-After header into seconds.
 *
 * Supports both delta-seconds and HTTP-date values per RFC 9110.
 */
function parseRetryAfterSeconds(retryAfter: string | null): number | undefined {
  if (retryAfter == null) return undefined;

  const trimmed = retryAfter.trim();
  if (!trimmed) return undefined;

  const delta = Number(trimmed);
  if (Number.isFinite(delta) && delta >= 0) {
    return Math.floor(delta);
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return undefined;
  }

  const secondsUntilDate = Math.ceil((dateMs - Date.now()) / 1000);
  return Math.max(0, secondsUntilDate);
}

/**
 * Convert an HTTP {@link Response} into a `Result<Response, OutfitterError>`.
 *
 * - **2xx** status codes return `Ok` with the original Response.
 * - Known error codes map to specific categories per the taxonomy:
 *   - 401 → auth, 403 → permission, 404 → not_found, 408 → timeout
 *   - 409 → conflict, 429 → rate_limit, 502/503 → network, 504 → timeout
 * - Unmapped 4xx → validation, unmapped 5xx → internal.
 * - All other codes (1xx, 3xx) → internal.
 *
 * @param response - The HTTP Response to inspect
 * @returns `Result.ok(response)` for 2xx, `Result.err(OutfitterError)` otherwise
 *
 * @example
 * ```typescript
 * const response = await fetch("https://api.example.com/data");
 * const result = fromFetch(response);
 *
 * if (result.isOk()) {
 *   const data = await result.value.json();
 * } else {
 *   console.error(result.error.category, result.error.message);
 * }
 * ```
 */
export function fromFetch(
  response: Response
): Result<Response, OutfitterError> {
  const { status, statusText } = response;
  const retryAfterSeconds =
    status === 429
      ? parseRetryAfterSeconds(response.headers.get("Retry-After"))
      : undefined;

  // 2xx success
  if (status >= 200 && status < 300) {
    return Result.ok(response);
  }

  // Look up specific mapping first
  const category = httpStatusToCategory[status];
  if (category != null) {
    return Result.err(
      createErrorForCategory(category, status, statusText, retryAfterSeconds)
    );
  }

  // Fallback: 4xx -> validation, 5xx -> internal, everything else -> internal
  if (status >= 400 && status < 500) {
    return Result.err(
      createErrorForCategory(
        "validation",
        status,
        statusText,
        retryAfterSeconds
      )
    );
  }

  if (status >= 500 && status < 600) {
    return Result.err(
      createErrorForCategory("internal", status, statusText, retryAfterSeconds)
    );
  }

  // 1xx, 3xx, or anything else
  return Result.err(
    createErrorForCategory("internal", status, statusText, retryAfterSeconds)
  );
}
