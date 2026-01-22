import { TaggedError } from "better-result";

/**
 * Error categories for classification, exit codes, and HTTP status mapping.
 *
 * Used for:
 * - CLI exit code determination
 * - HTTP status code mapping
 * - Error grouping in logs and metrics
 * - Client retry decisions (transient vs permanent)
 */
export type ErrorCategory =
	| "validation"
	| "not_found"
	| "conflict"
	| "permission"
	| "timeout"
	| "rate_limit"
	| "network"
	| "internal"
	| "auth"
	| "cancelled";

/**
 * Maps error category to CLI exit code.
 * Non-zero exit indicates error; specific values for script automation.
 */
export const exitCodeMap: Record<ErrorCategory, number> = {
	validation: 1,
	not_found: 2,
	conflict: 3,
	permission: 4,
	timeout: 5,
	rate_limit: 6,
	network: 7,
	internal: 8,
	auth: 9,
	cancelled: 130, // POSIX convention: 128 + SIGINT(2)
};

/**
 * Maps error category to HTTP status code.
 * Used by MCP servers and API responses.
 */
export const statusCodeMap: Record<ErrorCategory, number> = {
	validation: 400,
	not_found: 404,
	conflict: 409,
	permission: 403,
	timeout: 504,
	rate_limit: 429,
	network: 502,
	internal: 500,
	auth: 401,
	cancelled: 499,
};

/**
 * Serialized error format for JSON transport.
 */
export interface SerializedError {
	_tag: string;
	category: ErrorCategory;
	message: string;
	context?: Record<string, unknown>;
}

/**
 * Base interface for KitError properties.
 * All concrete error classes must include these fields.
 */
export interface KitErrorProps {
	message: string;
	category: ErrorCategory;
	context?: Record<string, unknown>;
}

/**
 * Get CLI exit code for an error category.
 */
export function getExitCode(category: ErrorCategory): number {
	return exitCodeMap[category];
}

/**
 * Get HTTP status code for an error category.
 */
export function getStatusCode(category: ErrorCategory): number {
	return statusCodeMap[category];
}

// ============================================================================
// Concrete Error Classes
// ============================================================================

/**
 * Input validation failed.
 *
 * @example
 * ```typescript
 * new ValidationError({ message: "Email format invalid", field: "email" });
 * ```
 */
export class ValidationError extends TaggedError("ValidationError")<{
	message: string;
	field?: string;
}>() {
	readonly category = "validation" as const;

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
 * Categorized as validation since assertions check input/state validity.
 *
 * @example
 * ```typescript
 * new AssertionError({ message: "Value is null or undefined" });
 * ```
 */
export class AssertionError extends TaggedError("AssertionError")<{
	message: string;
}>() {
	readonly category = "validation" as const;

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
 * ```
 */
export class NotFoundError extends TaggedError("NotFoundError")<{
	message: string;
	resourceType: string;
	resourceId: string;
}>() {
	readonly category = "not_found" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * State conflict (optimistic locking, concurrent modification).
 *
 * @example
 * ```typescript
 * new ConflictError({ message: "Resource was modified by another process" });
 * ```
 */
export class ConflictError extends TaggedError("ConflictError")<{
	message: string;
	context?: Record<string, unknown>;
}>() {
	readonly category = "conflict" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Authorization denied.
 *
 * @example
 * ```typescript
 * new PermissionError({ message: "Cannot delete read-only resource" });
 * ```
 */
export class PermissionError extends TaggedError("PermissionError")<{
	message: string;
	context?: Record<string, unknown>;
}>() {
	readonly category = "permission" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Operation timed out.
 *
 * @example
 * ```typescript
 * new TimeoutError({ message: "Database query timed out after 5000ms", operation: "Database query", timeoutMs: 5000 });
 * ```
 */
export class TimeoutError extends TaggedError("TimeoutError")<{
	message: string;
	operation: string;
	timeoutMs: number;
}>() {
	readonly category = "timeout" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Rate limit exceeded.
 *
 * @example
 * ```typescript
 * new RateLimitError({ message: "Rate limit exceeded, retry after 60s", retryAfterSeconds: 60 });
 * ```
 */
export class RateLimitError extends TaggedError("RateLimitError")<{
	message: string;
	retryAfterSeconds?: number;
}>() {
	readonly category = "rate_limit" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Network/transport failure.
 *
 * @example
 * ```typescript
 * new NetworkError({ message: "Connection refused to api.example.com" });
 * ```
 */
export class NetworkError extends TaggedError("NetworkError")<{
	message: string;
	context?: Record<string, unknown>;
}>() {
	readonly category = "network" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Unexpected internal error.
 *
 * @example
 * ```typescript
 * new InternalError({ message: "Unexpected state in processor" });
 * ```
 */
export class InternalError extends TaggedError("InternalError")<{
	message: string;
	context?: Record<string, unknown>;
}>() {
	readonly category = "internal" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Authentication failed (missing or invalid credentials).
 *
 * @example
 * ```typescript
 * new AuthError({ message: "Invalid API key", reason: "invalid" });
 * ```
 */
export class AuthError extends TaggedError("AuthError")<{
	message: string;
	reason?: "missing" | "invalid" | "expired";
}>() {
	readonly category = "auth" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Operation cancelled by user or signal.
 *
 * @example
 * ```typescript
 * new CancelledError({ message: "Operation cancelled by user" });
 * ```
 */
export class CancelledError extends TaggedError("CancelledError")<{
	message: string;
}>() {
	readonly category = "cancelled" as const;

	exitCode(): number {
		return getExitCode(this.category);
	}

	statusCode(): number {
		return getStatusCode(this.category);
	}
}

/**
 * Union type of all concrete error class instances.
 */
export type AnyKitError =
	| InstanceType<typeof ValidationError>
	| InstanceType<typeof AssertionError>
	| InstanceType<typeof NotFoundError>
	| InstanceType<typeof ConflictError>
	| InstanceType<typeof PermissionError>
	| InstanceType<typeof TimeoutError>
	| InstanceType<typeof RateLimitError>
	| InstanceType<typeof NetworkError>
	| InstanceType<typeof InternalError>
	| InstanceType<typeof AuthError>
	| InstanceType<typeof CancelledError>;

/**
 * Type alias for backwards compatibility with handler signatures.
 * Use AnyKitError for the union type.
 */
export type KitError = AnyKitError;
