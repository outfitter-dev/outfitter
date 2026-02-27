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
  expectErr,
  expectOk,
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
// Fetch-to-Result helper
export { fromFetch } from "./from-fetch.js";
// Errors
export {
  AlreadyExistsError,
  AmbiguousError,
  type AnyKitError,
  AssertionError,
  AuthError,
  CancelledError,
  ConflictError,
  // Granular error codes
  ERROR_CODES,
  // Types
  type ErrorCategory,
  type ErrorCategoryMeta,
  type ErrorCode,
  // Unified metadata helper
  errorCategoryMeta,
  // Maps
  exitCodeMap,
  // Helper functions
  getExitCode,
  getStatusCode,
  InternalError,
  // JSON-RPC code map (MCP protocol)
  jsonRpcCodeMap,
  type KitErrorProps,
  NetworkError,
  NotFoundError,
  type OutfitterError,
  PermissionError,
  RateLimitError,
  // Retryable flag map (agent safety)
  retryableMap,
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
  ResolvedConfig,
  SyncHandler,
} from "./handler.js";
// Hint types
export type { ActionHint, CLIHint, MCPHint } from "./hints.js";
export type {
  Logger,
  LoggerAdapter,
  LoggerFactory,
  LoggerFactoryConfig,
  LogLevel,
  LogMetadata,
  LogMethod,
} from "./logging.js";
// Logging contracts
export { createLoggerFactory } from "./logging.js";
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
export {
  combine2,
  combine3,
  expect,
  orElse,
  unwrapOrElse,
} from "./result/index.js";
// Schema utilities
export { type JsonSchema, zodToJsonSchema } from "./schema.js";
// Serialization utilities
export {
  deserializeError,
  type SerializeErrorOptions,
  safeParse,
  safeStringify,
  serializeError,
} from "./serialization.js";
// Validation utilities
export {
  createValidator,
  formatZodIssues,
  parseInput,
  validateInput,
} from "./validation.js";
// Wrap-error utilities
export {
  composeMappers,
  type ErrorMapper,
  isOutfitterError,
  wrapError,
} from "./wrap-error.js";
