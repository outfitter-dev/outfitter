import { describe, expect, it } from "bun:test";
import {
  createLoggerFactory,
  type Logger,
  type LoggerAdapter,
  type LoggerFactoryConfig,
} from "../logging.js";

interface TestBackendOptions {
  transport: "console" | "json";
  redactionEnabled: boolean;
}

describe("logger factory contract", () => {
  it("creates loggers through the provided adapter", () => {
    let observedConfig: LoggerFactoryConfig<TestBackendOptions> | undefined;
    const logger = createMockLogger();

    const adapter: LoggerAdapter<TestBackendOptions> = {
      createLogger(config) {
        observedConfig = config;
        return logger;
      },
    };

    const factory = createLoggerFactory(adapter);
    const created = factory.createLogger({
      name: "test-service",
      level: "debug",
      context: { requestId: "req-1" },
      backend: { transport: "console", redactionEnabled: true },
    });

    expect(created).toBe(logger);
    expect(observedConfig).toEqual({
      name: "test-service",
      level: "debug",
      context: { requestId: "req-1" },
      backend: { transport: "console", redactionEnabled: true },
    });
  });

  it("supports optional adapter flush lifecycle", async () => {
    let flushed = false;

    const factory = createLoggerFactory<TestBackendOptions>({
      createLogger: () => createMockLogger(),
      async flush() {
        flushed = true;
      },
    });

    await factory.flush();
    expect(flushed).toBe(true);
  });

  it("treats missing adapter flush as a no-op", async () => {
    const factory = createLoggerFactory<TestBackendOptions>({
      createLogger: () => createMockLogger(),
    });

    await expect(factory.flush()).resolves.toBeUndefined();
  });
});

function createMockLogger(): Logger {
  const createMethod = (): Logger["debug"] => {
    function method(
      _message: string,
      _metadata?: Record<string, unknown>
    ): void;
    function method(
      _metadata: Record<string, unknown>,
      _message: string
    ): never;
    function method(
      _messageOrMetadata: string | Record<string, unknown>,
      _metadataOrMessage?: Record<string, unknown> | string
    ): void {
      return;
    }

    return method;
  };

  const createLogger = (): Logger => ({
    trace: createMethod(),
    debug: createMethod(),
    info: createMethod(),
    warn: createMethod(),
    error: createMethod(),
    fatal: createMethod(),
    child(_context: Record<string, unknown>): Logger {
      return createLogger();
    },
  });

  return createLogger();
}
