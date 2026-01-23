/**
 * @outfitter/contracts
 *
 * Result/Error patterns, error taxonomy, handler contracts, and shared
 * interfaces for the Outfitter kit ecosystem.
 *
 * @packageDocumentation
 */

// Re-export Result from better-result for convenience
export { Result, TaggedError } from "better-result";

// Result utilities (extensions to better-result)
export { combine2, combine3, orElse, unwrapOrElse } from "./result/index.js";

// Assertion utilities
export {
	type NonEmptyArray,
	isNonEmptyArray,
	assertDefined,
	assertNonEmpty,
	assertMatches,
} from "./assert/index.js";

// Errors
export {
	// Types
	type ErrorCategory,
	type SerializedError,
	type AnyKitError,
	type KitError,
	type KitErrorProps,
	// Maps
	exitCodeMap,
	statusCodeMap,
	// Helper functions
	getExitCode,
	getStatusCode,
	// Concrete errors
	ValidationError,
	AssertionError,
	NotFoundError,
	ConflictError,
	PermissionError,
	TimeoutError,
	RateLimitError,
	NetworkError,
	InternalError,
	AuthError,
	CancelledError,
} from "./errors.js";

// Handler contract
export type {
	Logger,
	ResolvedConfig,
	HandlerContext,
	Handler,
	SyncHandler,
} from "./handler.js";

// Validation utilities
export { createValidator, validateInput } from "./validation.js";

// Serialization utilities
export {
	type SerializeErrorOptions,
	serializeError,
	deserializeError,
	safeStringify,
	safeParse,
} from "./serialization.js";

// Envelope utilities
export {
	type EnvelopeMeta,
	type PaginationMeta,
	type SuccessEnvelope,
	type ErrorEnvelope,
	type Envelope,
	type HttpResponse,
	toEnvelope,
	toHttpResponse,
} from "./envelope.js";

// Context utilities
export {
	type CreateContextOptions,
	createContext,
	generateRequestId,
} from "./context.js";

// Resilience utilities
export {
	type RetryOptions,
	type TimeoutOptions,
	retry,
	withTimeout,
} from "./resilience.js";

// Redactor
export {
	type RedactorConfig,
	type RedactionEvent,
	type RedactionCallback,
	type Redactor,
	DEFAULT_PATTERNS,
	DEFAULT_SENSITIVE_KEYS,
	createRedactor,
} from "./redactor.js";

// Adapter interfaces
export type {
	// Error types
	IndexError,
	CacheError,
	AdapterAuthError,
	StorageError,
	// Search types
	SearchOptions,
	SearchResult,
	IndexStats,
	// Adapter interfaces
	IndexAdapter,
	CacheAdapter,
	AuthAdapter,
	StorageAdapter,
} from "./adapters.js";
