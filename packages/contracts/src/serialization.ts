import type { Result } from "better-result";
import type { z } from "zod";
import type { KitError, SerializedError, ValidationError } from "./errors.js";

/**
 * Options for error serialization.
 */
export interface SerializeErrorOptions {
	/** Include stack trace (default: false in production, true in development) */
	includeStack?: boolean;
}

/**
 * Serialize a KitError to JSON-safe format.
 *
 * Strips stack traces in production, preserves in development.
 * Automatically redacts sensitive values from context.
 *
 * @param error - The error to serialize
 * @param options - Serialization options
 * @returns JSON-safe serialized error
 *
 * @example
 * ```typescript
 * const serialized = serializeError(new NotFoundError("note", "abc123"));
 * // { _tag: "NotFoundError", category: "not_found", message: "note not found: abc123", context: { resourceType: "note", resourceId: "abc123" } }
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function serializeError(
	_error: KitError,
	_options?: SerializeErrorOptions,
): SerializedError {
	throw new Error("Not implemented");
}

/**
 * Deserialize error from JSON (e.g., from MCP response).
 *
 * Returns a typed KitError subclass based on _tag.
 *
 * @param data - Serialized error data
 * @returns Reconstructed KitError instance
 *
 * @example
 * ```typescript
 * const error = deserializeError(jsonData);
 * if (error._tag === "NotFoundError") {
 *   // TypeScript knows error.resourceType exists
 * }
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function deserializeError(_data: SerializedError): KitError {
	throw new Error("Not implemented");
}

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
 *
 * @throws Error - Not implemented in scaffold
 */
export function safeStringify(_value: unknown, _space?: number): string {
	throw new Error("Not implemented");
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
 *
 * @throws Error - Not implemented in scaffold
 */
export function safeParse<T = unknown>(
	_json: string,
	_schema?: z.ZodType<T>,
): Result<T, ValidationError> {
	throw new Error("Not implemented");
}
