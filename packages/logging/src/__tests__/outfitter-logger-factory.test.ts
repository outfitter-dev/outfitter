import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { configureSync, resetSync } from "@logtape/logtape";
import {
  createOutfitterLoggerFactory,
  type LogRecord,
  resolveOutfitterLogLevel,
  type Sink,
} from "../index.js";

describe("resolveOutfitterLogLevel()", () => {
  let originalEnv: string | undefined;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    originalEnv = process.env["OUTFITTER_ENV"];
    originalLogLevel = process.env["OUTFITTER_LOG_LEVEL"];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OUTFITTER_ENV"];
    } else {
      process.env["OUTFITTER_ENV"] = originalEnv;
    }

    if (originalLogLevel === undefined) {
      delete process.env["OUTFITTER_LOG_LEVEL"];
    } else {
      process.env["OUTFITTER_LOG_LEVEL"] = originalLogLevel;
    }
  });

  it("uses OUTFITTER_LOG_LEVEL over explicit level", () => {
    process.env["OUTFITTER_LOG_LEVEL"] = "error";
    expect(resolveOutfitterLogLevel("debug")).toBe("error");
  });

  it("uses profile default in development", () => {
    process.env["OUTFITTER_ENV"] = "development";
    delete process.env["OUTFITTER_LOG_LEVEL"];
    expect(resolveOutfitterLogLevel()).toBe("debug");
  });

  it("maps null profile default to silent", () => {
    process.env["OUTFITTER_ENV"] = "production";
    delete process.env["OUTFITTER_LOG_LEVEL"];
    expect(resolveOutfitterLogLevel()).toBe("silent");
  });
});

describe("createOutfitterLoggerFactory()", () => {
  let originalEnv: string | undefined;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    originalEnv = process.env["OUTFITTER_ENV"];
    originalLogLevel = process.env["OUTFITTER_LOG_LEVEL"];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OUTFITTER_ENV"];
    } else {
      process.env["OUTFITTER_ENV"] = originalEnv;
    }

    if (originalLogLevel === undefined) {
      delete process.env["OUTFITTER_LOG_LEVEL"];
    } else {
      process.env["OUTFITTER_LOG_LEVEL"] = originalLogLevel;
    }
  });

  it("defaults to silent when profile disables logging", () => {
    process.env["OUTFITTER_ENV"] = "production";
    delete process.env["OUTFITTER_LOG_LEVEL"];

    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };
    const factory = createOutfitterLoggerFactory({
      defaults: { sinks: [sink] },
    });

    const logger = factory.createLogger({ name: "silent-default" });
    logger.info("not emitted");

    expect(records).toHaveLength(0);
  });

  it("applies default redaction when logging is enabled", () => {
    process.env["OUTFITTER_ENV"] = "production";
    delete process.env["OUTFITTER_LOG_LEVEL"];

    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };
    const factory = createOutfitterLoggerFactory({
      defaults: { sinks: [sink] },
    });

    const logger = factory.createLogger({
      name: "redacted-default",
      level: "info",
    });
    logger.info("request", { token: "secret-token" });

    expect(records).toHaveLength(1);
    expect(records[0].metadata?.token).toBe("[REDACTED]");
  });

  it("allows per-logger redaction opt-out", () => {
    process.env["OUTFITTER_ENV"] = "production";
    delete process.env["OUTFITTER_LOG_LEVEL"];

    const records: LogRecord[] = [];
    const sink: Sink = { write: (record) => records.push(record) };
    const factory = createOutfitterLoggerFactory({
      defaults: { sinks: [sink] },
    });

    const logger = factory.createLogger({
      name: "redaction-opt-out",
      level: "info",
      backend: {
        redaction: { enabled: false },
      },
    });
    logger.info("request", { token: "secret-token" });

    expect(records).toHaveLength(1);
    expect(records[0].metadata?.token).toBe("secret-token");
  });

  it("flush delegates to registered sink lifecycle", async () => {
    process.env["OUTFITTER_ENV"] = "development";
    delete process.env["OUTFITTER_LOG_LEVEL"];

    let flushCallCount = 0;
    const sink: Sink = {
      write: () => {
        // no-op
      },
      flush: async () => {
        flushCallCount += 1;
      },
    };
    const factory = createOutfitterLoggerFactory({
      defaults: { sinks: [sink] },
    });

    factory.createLogger({ name: "flush-check" });
    await factory.flush();

    expect(flushCallCount).toBe(1);
  });

  it("flush is isolated to sinks created by the same factory", async () => {
    process.env["OUTFITTER_ENV"] = "development";
    delete process.env["OUTFITTER_LOG_LEVEL"];

    let flushCallsA = 0;
    const sinkA: Sink = {
      write: () => {
        // no-op
      },
      flush: async () => {
        flushCallsA += 1;
      },
    };
    const factoryA = createOutfitterLoggerFactory({
      defaults: { sinks: [sinkA] },
    });

    let flushCallsB = 0;
    const sinkB: Sink = {
      write: () => {
        // no-op
      },
      flush: async () => {
        flushCallsB += 1;
      },
    };
    const factoryB = createOutfitterLoggerFactory({
      defaults: { sinks: [sinkB] },
    });

    factoryA.createLogger({ name: "factory-a" });
    factoryB.createLogger({ name: "factory-b" });

    await factoryA.flush();

    expect(flushCallsA).toBe(1);
    expect(flushCallsB).toBe(0);
  });

  it("supports logger creation when logtape is preconfigured", () => {
    resetSync();
    try {
      configureSync({
        sinks: {
          host: () => {
            // no-op host sink
          },
        },
        loggers: [
          {
            category: ["host"],
            sinks: ["host"],
            lowestLevel: "info",
          },
        ],
      });

      const records: LogRecord[] = [];
      const sink: Sink = {
        write: (record) => records.push(record),
      };
      const factory = createOutfitterLoggerFactory({
        defaults: { sinks: [sink], redaction: { enabled: false } },
      });

      expect(() => {
        const logger = factory.createLogger({
          name: "preconfigured",
          level: "info",
        });
        logger.info("preconfigured message");
      }).not.toThrow();

      expect(
        records.some((record) => record.message === "preconfigured message")
      ).toBe(true);
    } finally {
      resetSync();
    }
  });
});
