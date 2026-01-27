import { Result } from "better-result";
import type { z } from "zod";
import {
  AuthError,
  CancelledError,
  ConflictError,
  InternalError,
  NetworkError,
  NotFoundError,
  type OutfitterError,
  PermissionError,
  RateLimitError,
  type SerializedError,
  TimeoutError,
  ValidationError,
} from "./errors.js";
import {
  createRedactor,
  DEFAULT_PATTERNS,
  DEFAULT_SENSITIVE_KEYS,
} from "./redactor.js";

/**
 * Options for error serialization.
 */
export interface SerializeErrorOptions {
  /** Include stack trace (default: false in production, true in development) */
  includeStack?: boolean;
}

/**
 * Registry mapping error tags to their constructors.
 */
const errorRegistry = {
  ValidationError,
  NotFoundError,
  ConflictError,
  PermissionError,
  TimeoutError,
  RateLimitError,
  NetworkError,
  InternalError,
  AuthError,
  CancelledError,
} as const;

type ErrorTag = keyof typeof errorRegistry;

/**
 * Check if a string is a valid error tag.
 */
function isValidErrorTag(tag: string): tag is ErrorTag {
  return tag in errorRegistry;
}

/**
 * Extract context from a OutfitterError based on its type.
 */
function extractContext(
  error: OutfitterError
): Record<string, unknown> | undefined {
  const context: Record<string, unknown> = {};

  // Handle specific error types with known properties
  switch (error._tag) {
    case "ValidationError": {
      const ve = error as InstanceType<typeof ValidationError>;
      if (ve.field !== undefined) {
        context["field"] = ve.field;
      }
      break;
    }
    case "NotFoundError": {
      const nfe = error as InstanceType<typeof NotFoundError>;
      context["resourceType"] = nfe.resourceType;
      context["resourceId"] = nfe.resourceId;
      break;
    }
    case "TimeoutError": {
      const te = error as InstanceType<typeof TimeoutError>;
      context["operation"] = te.operation;
      context["timeoutMs"] = te.timeoutMs;
      break;
    }
    case "RateLimitError": {
      const rle = error as InstanceType<typeof RateLimitError>;
      if (rle.retryAfterSeconds !== undefined) {
        context["retryAfterSeconds"] = rle.retryAfterSeconds;
      }
      break;
    }
    case "AuthError": {
      const ae = error as InstanceType<typeof AuthError>;
      if (ae.reason !== undefined) {
        context["reason"] = ae.reason;
      }
      break;
    }
    case "ConflictError":
    case "PermissionError":
    case "NetworkError":
    case "InternalError": {
      // These have optional context property
      const ce = error as { context?: Record<string, unknown> };
      if (ce.context !== undefined) {
        Object.assign(context, ce.context);
      }
      break;
    }
    default:
      break;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

/**
 * Serialize a OutfitterError to JSON-safe format.
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
 */
export function serializeError(
  error: OutfitterError,
  options?: SerializeErrorOptions
): SerializedError {
  const isProduction = process.env["NODE_ENV"] === "production";
  const includeStack = options?.includeStack ?? !isProduction;

  const context = extractContext(error);

  const serialized: SerializedError = {
    _tag: error._tag,
    category: error.category,
    message: error.message,
  };

  if (context !== undefined) {
    serialized.context = context;
  }

  if (includeStack && error.stack !== undefined) {
    if (serialized.context === undefined) {
      serialized.context = {};
    }
    serialized.context["stack"] = error.stack;
  }

  return serialized;
}

/**
 * Deserialize error from JSON (e.g., from MCP response).
 *
 * Returns a typed OutfitterError subclass based on _tag.
 *
 * @param data - Serialized error data
 * @returns Reconstructed OutfitterError instance
 *
 * @example
 * ```typescript
 * const error = deserializeError(jsonData);
 * if (error._tag === "NotFoundError") {
 *   // TypeScript knows error.resourceType exists
 * }
 * ```
 */
export function deserializeError(data: SerializedError): OutfitterError {
  const tag = data._tag;

  if (!isValidErrorTag(tag)) {
    // Unknown error type, fall back to InternalError
    const props: { message: string; context?: Record<string, unknown> } = {
      message: data.message,
    };
    if (data.context !== undefined) {
      props.context = data.context;
    }
    return new InternalError(props);
  }

  const context = data.context ?? {};

  switch (tag) {
    case "ValidationError": {
      const props: { message: string; field?: string } = {
        message: data.message,
      };
      const field = context["field"] as string | undefined;
      if (field !== undefined) {
        props.field = field;
      }
      return new ValidationError(props);
    }

    case "NotFoundError":
      return new NotFoundError({
        message: data.message,
        resourceType: (context["resourceType"] as string) ?? "unknown",
        resourceId: (context["resourceId"] as string) ?? "unknown",
      });

    case "ConflictError": {
      const props: { message: string; context?: Record<string, unknown> } = {
        message: data.message,
      };
      if (Object.keys(context).length > 0) {
        props.context = context;
      }
      return new ConflictError(props);
    }

    case "PermissionError": {
      const props: { message: string; context?: Record<string, unknown> } = {
        message: data.message,
      };
      if (Object.keys(context).length > 0) {
        props.context = context;
      }
      return new PermissionError(props);
    }

    case "TimeoutError":
      return new TimeoutError({
        message: data.message,
        operation: (context["operation"] as string) ?? "unknown",
        timeoutMs: (context["timeoutMs"] as number) ?? 0,
      });

    case "RateLimitError": {
      const props: { message: string; retryAfterSeconds?: number } = {
        message: data.message,
      };
      const retryAfter = context["retryAfterSeconds"] as number | undefined;
      if (retryAfter !== undefined) {
        props.retryAfterSeconds = retryAfter;
      }
      return new RateLimitError(props);
    }

    case "NetworkError": {
      const props: { message: string; context?: Record<string, unknown> } = {
        message: data.message,
      };
      if (Object.keys(context).length > 0) {
        props.context = context;
      }
      return new NetworkError(props);
    }

    case "InternalError": {
      const props: { message: string; context?: Record<string, unknown> } = {
        message: data.message,
      };
      if (Object.keys(context).length > 0) {
        props.context = context;
      }
      return new InternalError(props);
    }

    case "AuthError": {
      const props: {
        message: string;
        reason?: "missing" | "invalid" | "expired";
      } = {
        message: data.message,
      };
      const reason = context["reason"] as
        | "missing"
        | "invalid"
        | "expired"
        | undefined;
      if (reason !== undefined) {
        props.reason = reason;
      }
      return new AuthError(props);
    }

    case "CancelledError":
      return new CancelledError({
        message: data.message,
      });
    default: {
      // Fallback for unknown tags
      const props: { message: string; context?: Record<string, unknown> } = {
        message: data.message,
      };
      if (Object.keys(context).length > 0) {
        props.context = context;
      }
      return new InternalError(props);
    }
  }
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
 */
export function safeStringify(value: unknown, space?: number): string {
  const seen = new WeakSet<object>();

  // Create a default redactor for sensitive data
  const redactor = createRedactor({
    patterns: [...DEFAULT_PATTERNS],
    keys: [...DEFAULT_SENSITIVE_KEYS],
  });

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
      redactor.isSensitiveKey(key) &&
      val !== null &&
      val !== undefined
    ) {
      return "[REDACTED]";
    }

    // Redact sensitive patterns in strings
    if (typeof val === "string") {
      return redactor.redactString(val);
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

  const issues = parseResult.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return Result.err(
    new ValidationError({
      message: `Schema validation failed: ${issues}`,
    })
  );
}
