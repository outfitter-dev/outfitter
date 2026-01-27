/**
 * @outfitter/contracts
 *
 * Result/Error patterns, error taxonomy, handler contracts, and shared
 * interfaces for the Outfitter Outfitter ecosystem.
 *
 * @packageDocumentation
 */

export type { TaggedErrorClass } from "better-result";
// Re-export Result from better-result for convenience
export { Result, TaggedError } from "better-result";
export type {
  ActionApiSpec,
  ActionCliInputContext,
  ActionCliOption,
  ActionCliSpec,
  ActionMcpSpec,
  ActionRegistry,
  ActionSpec,
  ActionSurface,
  ActionTrpcSpec,
  AnyActionSpec,
  HttpMethod,
} from "./actions.js";
// Action registry
export {
  ACTION_SURFACES,
  createActionRegistry,
  DEFAULT_REGISTRY_SURFACES,
  defineAction,
} from "./actions.js";
// Adapter interfaces
export type {
  AdapterAuthError,
  AuthAdapter,
  CacheAdapter,
  CacheError,
  // Adapter interfaces
  IndexAdapter,
  // Error types
  IndexError,
  IndexStats,
  // Search types
  SearchOptions,
  SearchResult,
  StorageAdapter,
  StorageError,
} from "./adapters.js";
// Assertion utilities
export {
  assertDefined,
  assertMatches,
  assertNonEmpty,
  isNonEmptyArray,
  type NonEmptyArray,
} from "./assert/index.js";
export type { ActionCapability, CapabilitySurface } from "./capabilities.js";
// Capability manifest
export {
  ACTION_CAPABILITIES,
  CAPABILITY_SURFACES,
  capability,
  capabilityAll,
  DEFAULT_ACTION_SURFACES,
  getActionsForSurface,
} from "./capabilities.js";
// Context utilities
export {
  type CreateContextOptions,
  createContext,
  generateRequestId,
} from "./context.js";

// Envelope utilities
export {
  type Envelope,
  type EnvelopeMeta,
  type ErrorEnvelope,
  type HttpResponse,
  type PaginationMeta,
  type SuccessEnvelope,
  toEnvelope,
  toHttpResponse,
} from "./envelope.js";
// Errors
export {
  type AnyKitError,
  AssertionError,
  AuthError,
  CancelledError,
  ConflictError,
  // Types
  type ErrorCategory,
  // Maps
  exitCodeMap,
  // Helper functions
  getExitCode,
  getStatusCode,
  InternalError,
  type KitErrorProps,
  NetworkError,
  NotFoundError,
  type OutfitterError,
  PermissionError,
  RateLimitError,
  type SerializedError,
  statusCodeMap,
  TimeoutError,
  // Concrete errors
  ValidationError,
} from "./errors.js";
// Handler contract
export type {
  Handler,
  HandlerContext,
  Logger,
  ResolvedConfig,
  SyncHandler,
} from "./handler.js";
// Recovery heuristics
export {
  type BackoffOptions,
  getBackoffDelay,
  isRecoverable,
  isRetryable,
  shouldRetry,
} from "./recovery.js";
// Redactor
export {
  createRedactor,
  DEFAULT_PATTERNS,
  DEFAULT_SENSITIVE_KEYS,
  type RedactionCallback,
  type RedactionEvent,
  type Redactor,
  type RedactorConfig,
} from "./redactor.js";
// Resilience utilities
export {
  type RetryOptions,
  retry,
  type TimeoutOptions,
  withTimeout,
} from "./resilience.js";
// Result utilities (extensions to better-result)
export { combine2, combine3, orElse, unwrapOrElse } from "./result/index.js";
// Serialization utilities
export {
  deserializeError,
  type SerializeErrorOptions,
  safeParse,
  safeStringify,
  serializeError,
} from "./serialization.js";
// Validation utilities
export { createValidator, validateInput } from "./validation.js";
