/* eslint-disable outfitter/max-file-lines -- Error serialization registry and context mapping must stay aligned in one module. */
/**
 * Error serialization and deserialization for transport across process
 * boundaries (MCP, IPC, HTTP).
 *
 * @internal
 */

import type { OutfitterError, SerializedError } from "../errors.js";
import {
  AlreadyExistsError,
  AmbiguousError,
  AssertionError,
  AuthError,
  CancelledError,
  ConflictError,
  InternalError,
  NetworkError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Error serialization
// ---------------------------------------------------------------------------

/**
 * Options for error serialization.
 */
export interface SerializeErrorOptions {
  /** Include stack trace (default: false in production, true otherwise). */
  includeStack?: boolean;
}

/**
 * Registry mapping error tags to their constructors.
 */
const errorRegistry = {
  ValidationError,
  AmbiguousError,
  AssertionError,
  NotFoundError,
  AlreadyExistsError,
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
      if (ve.context !== undefined) {
        Object.assign(context, ve.context);
      }
      if (ve.field !== undefined) {
        context["field"] = ve.field;
      }
      break;
    }
    case "NotFoundError": {
      const nfe = error as InstanceType<typeof NotFoundError>;
      if (nfe.context !== undefined) {
        Object.assign(context, nfe.context);
      }
      context["resourceType"] = nfe.resourceType;
      context["resourceId"] = nfe.resourceId;
      break;
    }
    case "AlreadyExistsError": {
      const aee = error as InstanceType<typeof AlreadyExistsError>;
      if (aee.context !== undefined) {
        Object.assign(context, aee.context);
      }
      context["resourceType"] = aee.resourceType;
      context["resourceId"] = aee.resourceId;
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
    case "AmbiguousError": {
      const amb = error as InstanceType<typeof AmbiguousError>;
      if (amb.context !== undefined) {
        Object.assign(context, amb.context);
      }
      context["candidates"] = amb.candidates;
      break;
    }
    case "AssertionError":
      // No extra fields beyond message
      break;
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
 * @param isProduction - Whether the environment is production. When omitted, falls back to
 *   `process.env["NODE_ENV"] === "production"` for safe-by-default stack stripping.
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
  options?: SerializeErrorOptions,
  isProduction?: boolean
): SerializedError {
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: safe default when isProduction not injected
  const production = isProduction ?? process.env["NODE_ENV"] === "production";
  const includeStack = options?.includeStack ?? !production;

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
      const props: {
        message: string;
        field?: string;
        context?: Record<string, unknown>;
      } = {
        message: data.message,
      };
      const field = context["field"] as string | undefined;
      if (field !== undefined) {
        props.field = field;
      }

      const contextWithoutField = Object.fromEntries(
        Object.entries(context).filter(([key]) => key !== "field")
      );

      if (Object.keys(contextWithoutField).length > 0) {
        props.context = contextWithoutField;
      }
      return new ValidationError(props);
    }

    case "NotFoundError": {
      const props: {
        message: string;
        resourceType: string;
        resourceId: string;
        context?: Record<string, unknown>;
      } = {
        message: data.message,
        resourceType: (context["resourceType"] as string) ?? "unknown",
        resourceId: (context["resourceId"] as string) ?? "unknown",
      };

      const contextWithoutIdentity = Object.fromEntries(
        Object.entries(context).filter(
          ([key]) => key !== "resourceType" && key !== "resourceId"
        )
      );

      if (Object.keys(contextWithoutIdentity).length > 0) {
        props.context = contextWithoutIdentity;
      }

      return new NotFoundError(props);
    }

    case "AlreadyExistsError": {
      const props: {
        message: string;
        resourceType: string;
        resourceId: string;
        context?: Record<string, unknown>;
      } = {
        message: data.message,
        resourceType: (context["resourceType"] as string) ?? "unknown",
        resourceId: (context["resourceId"] as string) ?? "unknown",
      };

      const contextWithoutIdentity = Object.fromEntries(
        Object.entries(context).filter(
          ([key]) => key !== "resourceType" && key !== "resourceId"
        )
      );

      if (Object.keys(contextWithoutIdentity).length > 0) {
        props.context = contextWithoutIdentity;
      }

      return new AlreadyExistsError(props);
    }

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

    case "AmbiguousError": {
      const props: {
        message: string;
        candidates: string[];
        context?: Record<string, unknown>;
      } = {
        message: data.message,
        candidates: (context["candidates"] as string[]) ?? [],
      };

      const contextWithoutCandidates = Object.fromEntries(
        Object.entries(context).filter(([key]) => key !== "candidates")
      );

      if (Object.keys(contextWithoutCandidates).length > 0) {
        props.context = contextWithoutCandidates;
      }

      return new AmbiguousError(props);
    }

    case "AssertionError":
      return new AssertionError({
        message: data.message,
      });

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
