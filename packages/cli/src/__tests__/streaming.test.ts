/**
 * Tests for NDJSON streaming adapter and --stream flag integration.
 *
 * Validates:
 * - VAL-STREAM-001: --stream flag is discoverable and accepted
 * - VAL-STREAM-002: Stream output is valid NDJSON with type discriminators
 * - VAL-STREAM-003: Event ordering is deterministic
 * - VAL-STREAM-004: Terminal envelope matches non-stream envelope shape
 * - VAL-STREAM-005: --stream is orthogonal to output mode
 * - VAL-STREAM-008: Streaming adapters are modular
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { StreamEvent } from "@outfitter/contracts";
import { ValidationError } from "@outfitter/contracts";
import { Result } from "better-result";

import {
  createSuccessEnvelope,
  createErrorEnvelope,
  runHandler,
} from "../envelope.js";
import { streamPreset } from "../query.js";
import {
  createNdjsonProgress,
  writeNdjsonLine,
  writeStreamEnvelope,
} from "../streaming.js";
import type { StreamLine } from "../streaming.js";

// =============================================================================
// Test Utilities
// =============================================================================

interface CapturedOutput {
  readonly stderr: string;
  readonly stdout: string;
}

async function captureOutput(
  fn: () => void | Promise<void>
): Promise<CapturedOutput> {
  let stdoutContent = "";
  let stderrContent = "";

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    stdoutContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    stderrContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout: stdoutContent, stderr: stderrContent };
}

function mockProcessExit(): {
  restore: () => void;
  getCapture: () => { exitCode: number | undefined; called: boolean };
} {
  let exitCode: number | undefined;
  let called = false;
  const originalExit = process.exit;

  // @ts-expect-error - mocking process.exit
  process.exit = (code?: number): never => {
    exitCode = code;
    called = true;
    throw new Error(`process.exit(${code}) called`);
  };

  return {
    restore: () => {
      process.exit = originalExit;
    },
    getCapture: () => ({ exitCode, called }),
  };
}

/**
 * Parse NDJSON output into an array of parsed lines.
 */
function parseNdjsonLines(output: string): unknown[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

// =============================================================================
// Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

// =============================================================================
// writeNdjsonLine() — low-level line writer
// =============================================================================

describe("writeNdjsonLine()", () => {
  test("writes a single JSON line to stdout", async () => {
    const captured = await captureOutput(() => {
      writeNdjsonLine({
        type: "start",
        command: "test",
        ts: "2024-01-01T00:00:00.000Z",
      });
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.type).toBe("start");
    expect(parsed.command).toBe("test");
  });

  test("each line is terminated with newline", async () => {
    const captured = await captureOutput(() => {
      writeNdjsonLine({ type: "progress", current: 1, total: 10 });
    });

    expect(captured.stdout).toEndWith("\n");
  });

  test("does not write to stderr", async () => {
    const captured = await captureOutput(() => {
      writeNdjsonLine({ type: "step", name: "scan", status: "complete" });
    });

    expect(captured.stderr).toBe("");
  });
});

// =============================================================================
// createNdjsonProgress() — ProgressCallback factory
// =============================================================================

describe("createNdjsonProgress()", () => {
  test("returns a ProgressCallback function", () => {
    const progress = createNdjsonProgress("test-cmd");
    expect(typeof progress).toBe("function");
  });

  test("writes stream events as NDJSON lines", async () => {
    const progress = createNdjsonProgress("test-cmd");

    const captured = await captureOutput(() => {
      progress({
        type: "start",
        command: "test-cmd",
        ts: "2024-01-01T00:00:00.000Z",
      });
      progress({ type: "progress", current: 5, total: 10 });
      progress({
        type: "step",
        name: "scan",
        status: "complete",
        duration_ms: 42,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines).toHaveLength(3);
  });

  test("each line is valid JSON with type discriminator", async () => {
    const progress = createNdjsonProgress("test-cmd");

    const captured = await captureOutput(() => {
      progress({
        type: "start",
        command: "test-cmd",
        ts: "2024-01-01T00:00:00.000Z",
      });
      progress({
        type: "progress",
        current: 3,
        total: 5,
        message: "Processing",
      });
      progress({ type: "step", name: "complete", status: "done" });
    });

    const lines = parseNdjsonLines(captured.stdout) as StreamLine[];
    expect(lines[0]).toHaveProperty("type", "start");
    expect(lines[1]).toHaveProperty("type", "progress");
    expect(lines[2]).toHaveProperty("type", "step");
  });

  test("preserves all event fields in NDJSON output", async () => {
    const progress = createNdjsonProgress("deploy");

    const captured = await captureOutput(() => {
      progress({
        type: "progress",
        current: 7,
        total: 20,
        message: "Deploying service 7 of 20",
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const event = lines[0] as Record<string, unknown>;
    expect(event["current"]).toBe(7);
    expect(event["total"]).toBe(20);
    expect(event["message"]).toBe("Deploying service 7 of 20");
  });
});

// =============================================================================
// writeStreamEnvelope() — terminal envelope writer
// =============================================================================

describe("writeStreamEnvelope()", () => {
  test("writes success envelope as NDJSON line to stdout", async () => {
    const envelope = createSuccessEnvelope("deploy", { status: "done" });

    const captured = await captureOutput(() => {
      writeStreamEnvelope(envelope);
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("deploy");
    expect(parsed.result).toEqual({ status: "done" });
  });

  test("writes error envelope as NDJSON line to stdout", async () => {
    const envelope = createErrorEnvelope("deploy", "validation", "Bad input");

    const captured = await captureOutput(() => {
      writeStreamEnvelope(envelope);
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error.category).toBe("validation");
    expect(parsed.error.message).toBe("Bad input");
  });

  test("envelope includes hints when present", async () => {
    const envelope = createSuccessEnvelope("deploy", { ok: true }, [
      { description: "Check status", command: "deploy status" },
    ]);

    const captured = await captureOutput(() => {
      writeStreamEnvelope(envelope);
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.hints).toHaveLength(1);
  });
});

// =============================================================================
// streamPreset() — --stream flag preset
// =============================================================================

describe("streamPreset()", () => {
  test("has id 'stream'", () => {
    const preset = streamPreset();
    expect(preset.id).toBe("stream");
  });

  test("defines --stream option", () => {
    const preset = streamPreset();
    expect(preset.options).toHaveLength(1);
    expect(preset.options[0]!.flags).toContain("--stream");
  });

  test("resolves stream as false by default", () => {
    const preset = streamPreset();
    const resolved = preset.resolve({});
    expect(resolved.stream).toBe(false);
  });

  test("resolves stream as true when passed", () => {
    const preset = streamPreset();
    const resolved = preset.resolve({ stream: true });
    expect(resolved.stream).toBe(true);
  });
});

// =============================================================================
// runHandler() + stream — Event ordering (VAL-STREAM-003)
// =============================================================================

describe("runHandler() with stream", () => {
  test("emits start event first, envelope last", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "progress",
            current: 1,
            total: 1,
            message: "Working",
          });
          return Result.ok({ status: "done" });
        },
        format: "json",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // First line must be start event
    const first = lines[0] as Record<string, unknown>;
    expect(first["type"]).toBe("start");

    // Last line must be the envelope
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
    expect(last["command"]).toBe("deploy");
  });

  test("progress events appear between start and envelope", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "check",
        handler: async (_input, ctx) => {
          ctx?.progress?.({ type: "step", name: "scan", status: "running" });
          ctx?.progress?.({ type: "progress", current: 5, total: 10 });
          ctx?.progress?.({
            type: "step",
            name: "scan",
            status: "complete",
            duration_ms: 100,
          });
          return Result.ok({ files: 10 });
        },
        format: "json",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout) as StreamLine[];
    // start, step, progress, step, envelope = 5 lines
    expect(lines).toHaveLength(5);

    // First is start
    expect(lines[0]).toHaveProperty("type", "start");
    // Middle three are events
    expect(lines[1]).toHaveProperty("type", "step");
    expect(lines[2]).toHaveProperty("type", "progress");
    expect(lines[3]).toHaveProperty("type", "step");
    // Last is envelope
    expect((lines[4] as Record<string, unknown>)["ok"]).toBe(true);
  });

  test("no events after envelope on success", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ done: true }),
        format: "json",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    // Should have at least 2 lines: start + envelope
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Last line is always the envelope
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });

  // VAL-STREAM-002: All lines are valid NDJSON
  test("all output lines are valid NDJSON", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "start",
            command: "deploy",
            ts: new Date().toISOString(),
          });
          ctx?.progress?.({ type: "progress", current: 1, total: 3 });
          ctx?.progress?.({ type: "step", name: "build", status: "complete" });
          return Result.ok({ deployed: true });
        },
        format: "json",
        stream: true,
      });
    });

    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    for (const line of rawLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  // VAL-STREAM-004: Terminal envelope matches non-stream envelope shape
  test("terminal envelope matches non-stream envelope shape exactly", async () => {
    // Run without stream
    const nonStreamCapture = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "done" }),
        format: "json",
        hints: () => [
          { description: "Check status", command: "deploy status" },
        ],
      });
    });
    const nonStreamEnvelope = JSON.parse(nonStreamCapture.stdout.trim());

    // Run with stream
    const streamCapture = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "done" }),
        format: "json",
        stream: true,
        hints: () => [
          { description: "Check status", command: "deploy status" },
        ],
      });
    });
    const streamLines = parseNdjsonLines(streamCapture.stdout);
    const streamEnvelope = streamLines[streamLines.length - 1];

    expect(streamEnvelope).toEqual(nonStreamEnvelope);
  });

  // VAL-STREAM-004: Error envelope shape matches
  test("error envelope shape matches non-stream error envelope", async () => {
    const exitMock = mockProcessExit();
    let nonStreamEnvelope: unknown;

    try {
      const nonStreamCapture = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(new ValidationError({ message: "Bad input" })),
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });
      nonStreamEnvelope = JSON.parse(nonStreamCapture.stderr.trim());
    } finally {
      exitMock.restore();
    }

    // Now run with stream — error envelope goes to stdout as NDJSON
    const exitMock2 = mockProcessExit();
    try {
      const streamCapture = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(new ValidationError({ message: "Bad input" })),
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });
      const streamLines = parseNdjsonLines(streamCapture.stdout);
      const streamEnvelope = streamLines[streamLines.length - 1];

      expect(streamEnvelope).toEqual(nonStreamEnvelope);
    } finally {
      exitMock2.restore();
    }
  });
});

// =============================================================================
// --stream orthogonality with output mode (VAL-STREAM-005)
// =============================================================================

describe("--stream orthogonality with output mode", () => {
  test("stream works with format: json", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ data: "hello" }),
        format: "json",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });

  test("stream works with format: human", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ data: "hello" }),
        format: "human",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });

  test("stream works with format: jsonl", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ data: "hello" }),
        format: "jsonl",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });

  test("stream works with OUTFITTER_JSON=1 env var", async () => {
    process.env["OUTFITTER_JSON"] = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ data: "hello" }),
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });

  test("stream works with OUTFITTER_JSONL=1 env var", async () => {
    process.env["OUTFITTER_JSONL"] = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ data: "hello" }),
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const last = lines[lines.length - 1] as Record<string, unknown>;
    expect(last["ok"]).toBe(true);
  });
});

// =============================================================================
// Without --stream, output is unchanged (VAL-STREAM-001)
// =============================================================================

describe("without --stream, output is unchanged", () => {
  test("JSON output without stream is standard envelope", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "done" }),
        format: "json",
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("deploy");
    // Should be a single line, not NDJSON with start event
    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    expect(rawLines).toHaveLength(1);
  });

  test("stream: false behaves same as no stream", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "done" }),
        format: "json",
        stream: false,
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    expect(rawLines).toHaveLength(1);
  });
});

// =============================================================================
// Context receives progress callback (VAL-STREAM-006)
// =============================================================================

describe("handler receives progress callback via context", () => {
  test("handler context has progress callback when stream is active", async () => {
    let progressWasProvided = false;

    await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async (_input, ctx) => {
          progressWasProvided = ctx?.progress !== undefined;
          return Result.ok({ ok: true });
        },
        format: "json",
        stream: true,
        contextFactory: () => ({}),
      });
    });

    expect(progressWasProvided).toBe(true);
  });

  test("handler context has no progress callback without stream", async () => {
    let progressWasProvided = false;

    await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async (_input, ctx) => {
          progressWasProvided = ctx?.progress !== undefined;
          return Result.ok({ ok: true });
        },
        format: "json",
        contextFactory: () => ({}),
      });
    });

    expect(progressWasProvided).toBe(false);
  });
});

// =============================================================================
// safeStringify safety — BigInt, circular refs, sensitive data redaction
// =============================================================================

describe("writeNdjsonLine() safety via safeStringify", () => {
  test("serializes BigInt values as strings instead of crashing", async () => {
    const captured = await captureOutput(() => {
      writeNdjsonLine({ type: "progress", count: 9007199254740993n });
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.count).toBe("9007199254740993");
  });

  test("handles circular references with [Circular] marker", async () => {
    const obj: Record<string, unknown> = { type: "progress", name: "scan" };
    obj["self"] = obj;

    const captured = await captureOutput(() => {
      writeNdjsonLine(obj);
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.self).toBe("[Circular]");
    expect(parsed.type).toBe("progress");
  });

  test("redacts sensitive keys in stream data", async () => {
    const captured = await captureOutput(() => {
      writeNdjsonLine({
        type: "progress",
        apiKey: "test-key-placeholder",
        data: "safe",
      });
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed.apiKey).toBe("[REDACTED]");
    expect(parsed.data).toBe("safe");
  });

  test("BigInt values in streamed result envelope serialize correctly", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "count",
        handler: async () => Result.ok({ total: BigInt(123456789012345678n) }),
        format: "json",
        stream: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as Record<string, unknown>;
    expect(envelope["ok"]).toBe(true);
    const result = envelope["result"] as Record<string, unknown>;
    expect(result["total"]).toBe("123456789012345678");
  });

  test("circular references in streamed progress events produce valid NDJSON", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "scan",
        handler: async (_input, ctx) => {
          const event: Record<string, unknown> = {
            type: "progress" as const,
            current: 1,
            total: 5,
          };
          event["ref"] = event;
          ctx?.progress?.(event as unknown as StreamEvent);
          return Result.ok({ done: true });
        },
        format: "json",
        stream: true,
      });
    });

    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    for (const line of rawLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
