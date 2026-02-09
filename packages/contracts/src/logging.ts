/**
 * Shared logging contracts for backend-agnostic logger integration.
 *
 * The `Logger` interface is the minimal surface required by handler contexts.
 * `LoggerAdapter` and `createLoggerFactory` allow runtime packages to plug in
 * backend-specific implementations while keeping transports backend-agnostic.
 */

/**
 * Log levels ordered from least to most severe.
 *
 * The special `silent` level disables logging output.
 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/** Structured metadata attached to log messages. */
export type LogMetadata = Record<string, unknown>;

/**
 * Message-first logger method with metadata-first overload for strict misuse
 * detection in TypeScript. Calling with metadata first intentionally resolves to
 * `never` for compile-time feedback.
 */
export interface LogMethod {
  (message: string, metadata?: LogMetadata): void;
  (metadata: LogMetadata, message: string): never;
}

/**
 * Logger interface for handler contexts and cross-package contracts.
 */
export interface Logger {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  child(context: LogMetadata): Logger;
}

/**
 * Configuration passed through the logger factory to backend adapters.
 *
 * `backend` carries adapter-specific configuration in a strongly typed way.
 */
export interface LoggerFactoryConfig<TBackendOptions = unknown> {
  /** Logger category/name identifying the source (e.g., "cli", "mcp") */
  name: string;
  /** Minimum level to emit */
  level?: LogLevel;
  /** Static context attached to every emitted record */
  context?: LogMetadata;
  /** Adapter-specific backend options */
  backend?: TBackendOptions;
}

/**
 * Backend adapter contract used by the logger factory.
 *
 * Runtime packages provide concrete adapters (for example logtape or custom
 * implementations) behind this contract.
 */
export interface LoggerAdapter<TBackendOptions = unknown> {
  createLogger(config: LoggerFactoryConfig<TBackendOptions>): Logger;
  flush?(): Promise<void>;
}

/**
 * Backend-agnostic logger factory surface consumed by CLI/MCP runtime code.
 */
export interface LoggerFactory<TBackendOptions = unknown> {
  createLogger(config: LoggerFactoryConfig<TBackendOptions>): Logger;
  flush(): Promise<void>;
}

/**
 * Create a logger factory from a backend adapter implementation.
 */
export function createLoggerFactory<TBackendOptions = unknown>(
  adapter: LoggerAdapter<TBackendOptions>
): LoggerFactory<TBackendOptions> {
  return {
    createLogger(config) {
      return adapter.createLogger(config);
    },
    async flush() {
      await adapter.flush?.();
    },
  };
}
