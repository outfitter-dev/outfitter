/**
 * Safe JSON stringify/parse wrappers that handle edge cases (circular
 * references, BigInt, sensitive data) and return Result types instead of
 * throwing.
 *
 * @internal
 */

import { Result } from "better-result";
import type { z } from "zod";

import { ValidationError } from "../errors.js";
import {
  createRedactor,
  DEFAULT_PATTERNS,
  DEFAULT_SENSITIVE_KEYS,
} from "../redactor.js";
import { formatZodIssues } from "../validation.js";

/** Module-scope redactor singleton — avoids re-creating on every call. */
const defaultRedactor = createRedactor({
  patterns: [...DEFAULT_PATTERNS],
  keys: [...DEFAULT_SENSITIVE_KEYS],
});

/**
 * Safely stringify any value to JSON.
 *
 * Handles circular references, BigInt, and other non-JSON-safe values.
 * Applies redaction to sensitive values.
 *
 * @param value - Value to stringify
 * @param space - Indentation (default: undefined for compact)
 * @returns JSON string
 *
 * @example
 * ```typescript
 * const json = safeStringify({ apiKey: "sk-secret", data: "safe" });
 * // '{"apiKey":"[REDACTED]","data":"safe"}'
 * ```
 */
export function safeStringify(value: unknown, space?: number): string {
  const seen = new WeakSet<object>();

  const replacer = (key: string, val: unknown): unknown => {
    // Handle BigInt
    if (typeof val === "bigint") {
      return val.toString();
    }

    // Handle circular references
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }

    // Redact sensitive key values (key is empty string for root)
    if (
      key !== "" &&
      defaultRedactor.isSensitiveKey(key) &&
      val !== null &&
      val !== undefined
    ) {
      return "[REDACTED]";
    }

    // Redact sensitive patterns in strings
    if (typeof val === "string") {
      return defaultRedactor.redactString(val);
    }

    return val;
  };

  return JSON.stringify(value, replacer, space);
}

/**
 * Safely parse JSON string with optional schema validation.
 *
 * Returns Result instead of throwing on invalid JSON.
 *
 * @typeParam T - Expected parsed type (or unknown if no schema)
 * @param json - JSON string to parse
 * @param schema - Optional Zod schema for validation
 * @returns Result with parsed value or ValidationError
 *
 * @example
 * ```typescript
 * const result = safeParse<Config>('{"port": 3000}', ConfigSchema);
 * if (result.isOk()) {
 *   const config = result.unwrap();
 * }
 * ```
 */
export function safeParse<T = unknown>(
  json: string,
  schema?: z.ZodType<T>
): Result<T, ValidationError> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown parse error";
    return Result.err(
      new ValidationError({
        message: `JSON parse error: ${errorMessage}`,
      })
    );
  }

  // If no schema provided, return parsed value as-is
  if (schema === undefined) {
    return Result.ok(parsed as T);
  }

  // Validate against schema
  const parseResult = schema.safeParse(parsed);

  if (parseResult.success) {
    return Result.ok(parseResult.data);
  }

  return Result.err(
    new ValidationError({
      message: `Schema validation failed: ${formatZodIssues(parseResult.error.issues)}`,
    })
  );
}
