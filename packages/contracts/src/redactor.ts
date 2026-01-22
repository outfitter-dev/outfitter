/**
 * Configuration for creating a redactor.
 */
export interface RedactorConfig {
	/** Regex patterns to match and redact */
	patterns: RegExp[];

	/** Object keys whose values should always be redacted */
	keys: string[];

	/** Replacement string (default: "[REDACTED]") */
	replacement?: string;

	/** Whether to redact recursively in nested objects (default: true) */
	deep?: boolean;
}

/**
 * Redaction event for audit logging.
 */
export interface RedactionEvent {
	/** Type of redaction applied */
	redactedBy: "pattern" | "key";

	/** Identifier of the pattern/key that matched */
	matcher: string;

	/** Location in the object path (e.g., "config.auth.apiKey") */
	path: string;
}

/**
 * Callback for redaction events.
 */
export type RedactionCallback = (event: RedactionEvent) => void;

/**
 * Redactor - sensitive data scrubbing for logs, errors, and output.
 *
 * Applied automatically by @outfitter/logging. Manual application
 * required when building custom output or error context.
 *
 * @example
 * ```typescript
 * const redactor = createRedactor({
 *   patterns: [
 *     /Bearer [A-Za-z0-9-_]+/g,           // Auth headers
 *     /sk-[A-Za-z0-9]{48}/g,              // OpenAI keys
 *     /ghp_[A-Za-z0-9]{36}/g,             // GitHub PATs
 *     /password[:=]\s*["']?[^"'\s]+/gi,   // Password fields
 *   ],
 *   keys: ["apiKey", "secret", "token", "password", "credential"],
 *   replacement: "[REDACTED]",
 * });
 *
 * const safeLog = redactor.redact(sensitiveObject);
 * ```
 */
export interface Redactor {
	/** Redact sensitive values from an object (deep) */
	redact<T>(value: T): T;

	/** Redact sensitive values from a string */
	redactString(value: string): string;

	/** Check if a key name is sensitive */
	isSensitiveKey(key: string): boolean;

	/** Add a pattern at runtime */
	addPattern(pattern: RegExp): void;

	/** Add a sensitive key at runtime */
	addSensitiveKey(key: string): void;
}

/**
 * Default patterns for common secrets.
 *
 * Covers:
 * - API keys (OpenAI, Anthropic, GitHub, etc.)
 * - Auth headers (Bearer tokens)
 * - Connection strings (database URLs)
 * - Password fields in various formats
 */
export const DEFAULT_PATTERNS: RegExp[] = [
	// Auth headers
	/Bearer [A-Za-z0-9-_.]+/g,
	/Basic [A-Za-z0-9+/=]+/g,

	// OpenAI API keys (flexible length for format changes)
	/sk-[A-Za-z0-9]{32,}/g,

	// Anthropic API keys
	/sk-ant-[A-Za-z0-9-_]{95}/g,

	// GitHub PATs
	/ghp_[A-Za-z0-9]{36}/g,
	/gho_[A-Za-z0-9]{36}/g,
	/ghu_[A-Za-z0-9]{36}/g,
	/ghs_[A-Za-z0-9]{36}/g,
	/ghr_[A-Za-z0-9]{36}/g,
	/github_pat_[A-Za-z0-9_]{22,}/g,

	// AWS keys
	/AKIA[A-Z0-9]{16}/g,

	// Slack tokens
	/xox[baprs]-[A-Za-z0-9-]+/g,

	// PEM private keys
	/-----BEGIN [A-Z ]+ KEY-----/g,

	// Generic password patterns
	/password[:=]\s*["']?[^"'\s]+/gi,
	/secret[:=]\s*["']?[^"'\s]+/gi,

	// Connection strings
	/(?:postgres|mysql|mongodb|redis):\/\/[^@\s]+@[^\s]+/g,
];

/**
 * Default sensitive key names.
 *
 * Object keys matching these (case-insensitive) will have their values redacted.
 */
export const DEFAULT_SENSITIVE_KEYS: string[] = [
	"apiKey",
	"api_key",
	"apikey",
	"secret",
	"secretKey",
	"secret_key",
	"token",
	"accessToken",
	"access_token",
	"refreshToken",
	"refresh_token",
	"password",
	"passwd",
	"credential",
	"credentials",
	"private",
	"privateKey",
	"private_key",
	"authorization",
	"auth",
];

/**
 * Create a redactor instance with the given configuration.
 *
 * @param config - Redactor configuration
 * @returns Configured Redactor instance
 *
 * @example
 * ```typescript
 * const redactor = createRedactor({
 *   patterns: [...DEFAULT_PATTERNS],
 *   keys: [...DEFAULT_SENSITIVE_KEYS],
 * });
 *
 * const safe = redactor.redact({
 *   user: "alice",
 *   apiKey: "sk-abc123...",
 * });
 * // { user: "alice", apiKey: "[REDACTED]" }
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function createRedactor(_config: RedactorConfig): Redactor {
	throw new Error("Not implemented");
}
