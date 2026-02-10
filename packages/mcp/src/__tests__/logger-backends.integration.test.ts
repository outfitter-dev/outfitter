import { describe, expect, it } from "bun:test";
import {
  createLoggerFactory,
  type Logger,
  type LoggerAdapter,
  type LoggerFactory,
  type LoggerFactoryConfig,
  Result,
} from "@outfitter/contracts";
import {
  createOutfitterLoggerFactory,
  type LogRecord,
  type Sink,
} from "@outfitter/logging";
import { z } from "zod";
import { createMcpServer, defineTool } from "../index.js";

interface MemoryRecord {
  category: string;
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  metadata?: Record<string, unknown>;
}

interface MemoryBackendOptions {
  records: MemoryRecord[];
}

describe("logger backend integration", () => {
  it("works with the outfitter default backend factory", async () => {
    const records: LogRecord[] = [];
    const sink: Sink = {
      write(record) {
        records.push(record);
      },
    };
    const factory = createOutfitterLoggerFactory({
      defaults: {
        sinks: [sink],
        redaction: { enabled: false },
      },
    });

    const invocationSucceeded = await invokeLoggedTool(factory);
    expect(invocationSucceeded).toBe(true);

    const handlerRecord = records.find(
      (record) => record.message === "backend integration log"
    );
    expect(handlerRecord).toBeDefined();
    expect(handlerRecord?.metadata?.tool).toBe("backend-test");
    expect(typeof handlerRecord?.metadata?.requestId).toBe("string");
  });

  it("works with a custom logger adapter backend", async () => {
    const records: MemoryRecord[] = [];
    const factory = createLoggerFactory<MemoryBackendOptions>(
      createMemoryLoggerAdapter()
    );

    const invocationSucceeded = await invokeLoggedTool(factory, { records });
    expect(invocationSucceeded).toBe(true);

    const handlerRecord = records.find(
      (record) => record.message === "backend integration log"
    );
    expect(handlerRecord).toBeDefined();
    expect(handlerRecord?.metadata?.adapter).toBe("memory");
    expect(handlerRecord?.metadata?.tool).toBe("backend-test");
    expect(typeof handlerRecord?.metadata?.requestId).toBe("string");
  });

  it("routes default MCP logger output to stderr", async () => {
    const previousEnv = process.env["OUTFITTER_ENV"];
    process.env["OUTFITTER_ENV"] = "development";

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    process.stdout.write = ((chunk: unknown) => {
      stdoutChunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    process.stderr.write = ((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const server = createMcpServer({
        name: "default-logger-server",
        version: "1.0.0",
      });

      server.registerTool(
        defineTool({
          name: "default-logger-test",
          description: "Exercise default logger sink routing",
          inputSchema: z.object({}),
          handler: async (_input, ctx) => {
            ctx.logger.info("default fallback log");
            return Result.ok({ ok: true });
          },
        })
      );

      const result = await server.invokeTool<{ ok: boolean }>(
        "default-logger-test",
        {}
      );
      expect(result.isOk()).toBe(true);
    } finally {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;

      if (previousEnv === undefined) {
        delete process.env["OUTFITTER_ENV"];
      } else {
        process.env["OUTFITTER_ENV"] = previousEnv;
      }
    }

    expect(stdoutChunks.join("")).not.toContain("default fallback log");
    expect(stderrChunks.join("")).toContain("default fallback log");
  });
});

async function invokeLoggedTool<TBackendOptions>(
  factory: LoggerFactory<TBackendOptions>,
  backend?: TBackendOptions
): Promise<boolean> {
  const config: LoggerFactoryConfig<TBackendOptions> = {
    name: "mcp-integration",
    level: "info",
  };
  if (backend !== undefined) {
    config.backend = backend;
  }

  const logger = factory.createLogger(config);
  const server = createMcpServer({
    name: "integration-server",
    version: "1.0.0",
    logger,
  });

  server.registerTool(
    defineTool({
      name: "backend-test",
      description: "Exercise logger backend integration",
      inputSchema: z.object({}),
      handler: async (_input, ctx) => {
        ctx.logger.info("backend integration log");
        return Result.ok({ ok: true });
      },
    })
  );

  const result = await server.invokeTool<{ ok: boolean }>("backend-test", {});
  return result.isOk() && result.value.ok === true;
}

function createMemoryLoggerAdapter(): LoggerAdapter<MemoryBackendOptions> {
  return {
    createLogger(config) {
      const records = config.backend?.records;
      if (records === undefined) {
        throw new Error("Memory backend requires a records array");
      }
      return createMemoryLogger(config.name, records, config.context ?? {});
    },
  };
}

function createMemoryLogger(
  category: string,
  records: MemoryRecord[],
  context: Record<string, unknown>
): Logger {
  const createMethod = (level: MemoryRecord["level"]): Logger["info"] =>
    ((message: string, metadata?: Record<string, unknown>) => {
      const mergedMetadata = {
        adapter: "memory",
        ...context,
        ...(metadata ?? {}),
      };
      records.push({
        category,
        level,
        message,
        ...(Object.keys(mergedMetadata).length > 0
          ? { metadata: mergedMetadata }
          : {}),
      });
    }) as Logger["info"];

  return {
    trace: createMethod("trace"),
    debug: createMethod("debug"),
    info: createMethod("info"),
    warn: createMethod("warn"),
    error: createMethod("error"),
    fatal: createMethod("fatal"),
    child(childContext) {
      return createMemoryLogger(category, records, {
        ...context,
        ...childContext,
      });
    },
  };
}
