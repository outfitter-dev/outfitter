/**
 * Tests for @outfitter/contracts/stream
 *
 * Tests cover:
 * - StreamEvent discriminated union types (compile-time + runtime shape)
 * - ProgressCallback type
 * - HandlerContext.progress integration
 *
 * Total: 11 tests
 */
import { describe, expect, it } from "bun:test";

import { Result } from "better-result";

import { createContext } from "../context.js";
import type { Handler, HandlerContext } from "../handler.js";
import type {
  ProgressCallback,
  StreamEvent,
  StreamProgressEvent,
  StreamStartEvent,
  StreamStepEvent,
} from "../stream.js";

// ============================================================================
// StreamEvent Type Tests
// ============================================================================

describe("StreamEvent", () => {
  it("StreamStartEvent has type 'start' with command and ts fields", () => {
    const event: StreamStartEvent = {
      type: "start",
      command: "check tsdoc",
      ts: new Date().toISOString(),
    };

    expect(event.type).toBe("start");
    expect(event.command).toBe("check tsdoc");
    expect(typeof event.ts).toBe("string");
  });

  it("StreamStepEvent has type 'step' with name, status, and optional duration_ms", () => {
    const event: StreamStepEvent = {
      type: "step",
      name: "scanning files",
      status: "complete",
    };

    expect(event.type).toBe("step");
    expect(event.name).toBe("scanning files");
    expect(event.status).toBe("complete");

    // duration_ms is optional
    const withDuration: StreamStepEvent = {
      type: "step",
      name: "scanning files",
      status: "complete",
      duration_ms: 42,
    };

    expect(withDuration.duration_ms).toBe(42);
  });

  it("StreamProgressEvent has type 'progress' with current, total, and optional message", () => {
    const event: StreamProgressEvent = {
      type: "progress",
      current: 5,
      total: 10,
    };

    expect(event.type).toBe("progress");
    expect(event.current).toBe(5);
    expect(event.total).toBe(10);

    // message is optional
    const withMessage: StreamProgressEvent = {
      type: "progress",
      current: 5,
      total: 10,
      message: "Processing file 5 of 10",
    };

    expect(withMessage.message).toBe("Processing file 5 of 10");
  });

  it("StreamEvent union narrows by type discriminator", () => {
    const events: StreamEvent[] = [
      { type: "start", command: "check", ts: "2024-01-01T00:00:00Z" },
      { type: "step", name: "lint", status: "complete" },
      { type: "progress", current: 1, total: 5 },
    ];

    for (const event of events) {
      switch (event.type) {
        case "start":
          // TypeScript narrows to StreamStartEvent
          expect(event.command).toBe("check");
          break;
        case "step":
          // TypeScript narrows to StreamStepEvent
          expect(event.name).toBe("lint");
          break;
        case "progress":
          // TypeScript narrows to StreamProgressEvent
          expect(event.current).toBe(1);
          break;
      }
    }
  });
});

// ============================================================================
// ProgressCallback Tests
// ============================================================================

describe("ProgressCallback", () => {
  it("accepts any StreamEvent and returns void", () => {
    const events: StreamEvent[] = [];
    const callback: ProgressCallback = (event: StreamEvent) => {
      events.push(event);
    };

    callback({ type: "start", command: "test", ts: "2024-01-01T00:00:00Z" });
    callback({ type: "step", name: "phase1", status: "running" });
    callback({ type: "progress", current: 3, total: 10, message: "working" });

    expect(events).toHaveLength(3);
    expect(events[0]!.type).toBe("start");
    expect(events[1]!.type).toBe("step");
    expect(events[2]!.type).toBe("progress");
  });
});

// ============================================================================
// HandlerContext.progress Integration Tests
// ============================================================================

describe("HandlerContext.progress", () => {
  it("is optional on HandlerContext (undefined when no streaming)", () => {
    const ctx: HandlerContext = {
      requestId: "test-id",
      logger: {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => ctx.logger,
      },
      cwd: "/test",
      env: {},
    };

    // progress is optional — undefined by default
    expect(ctx.progress).toBeUndefined();
  });

  it("can be set to a ProgressCallback", () => {
    const events: StreamEvent[] = [];
    const progress: ProgressCallback = (event) => {
      events.push(event);
    };

    const ctx: HandlerContext = {
      requestId: "test-id",
      logger: {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => ctx.logger,
      },
      cwd: "/test",
      env: {},
      progress,
    };

    expect(ctx.progress).toBeDefined();
    ctx.progress!({
      type: "start",
      command: "test",
      ts: "2024-01-01T00:00:00Z",
    });
    expect(events).toHaveLength(1);
  });

  it("handler can call ctx.progress when defined (transport-agnostic)", async () => {
    const events: StreamEvent[] = [];
    const progress: ProgressCallback = (event) => {
      events.push(event);
    };

    // Handler that uses ctx.progress without knowing the transport
    // oxlint-disable-next-line outfitter/handler-must-return-result -- test handler intentionally uses Handler type alias
    const handler: Handler<{ items: string[] }, number> = async (
      input,
      ctx
    ) => {
      ctx.progress?.({
        type: "start",
        command: "process-items",
        ts: new Date().toISOString(),
      });

      for (let i = 0; i < input.items.length; i++) {
        ctx.progress?.({
          type: "progress",
          current: i + 1,
          total: input.items.length,
          message: `Processing ${input.items[i]}`,
        });
      }

      ctx.progress?.({
        type: "step",
        name: "complete",
        status: "done",
        duration_ms: 42,
      });

      return Result.ok(input.items.length);
    };

    const ctx = createContext({ requestId: "test-req" });
    // Attach progress callback (as transport adapter would)
    const ctxWithProgress: HandlerContext = { ...ctx, progress };

    const result = await handler({ items: ["a", "b", "c"] }, ctxWithProgress);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(3);

    // Verify events were captured
    expect(events).toHaveLength(5); // start + 3 progress + 1 step
    expect(events[0]!.type).toBe("start");
    expect(events[1]!.type).toBe("progress");
    expect(events[2]!.type).toBe("progress");
    expect(events[3]!.type).toBe("progress");
    expect(events[4]!.type).toBe("step");
  });

  it("handler works without progress (non-streaming)", async () => {
    // oxlint-disable-next-line outfitter/handler-must-return-result -- test handler intentionally uses Handler type alias
    const handler: Handler<{ items: string[] }, number> = async (
      input,
      ctx
    ) => {
      // Handler uses optional chaining — no error when progress is undefined
      ctx.progress?.({
        type: "start",
        command: "process-items",
        ts: new Date().toISOString(),
      });

      return Result.ok(input.items.length);
    };

    const ctx = createContext({ requestId: "test-req" });
    // No progress callback — non-streaming mode
    const result = await handler({ items: ["a", "b"] }, ctx);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(2);
  });

  it("createContext supports progress option", () => {
    const events: StreamEvent[] = [];
    const progress: ProgressCallback = (event) => {
      events.push(event);
    };

    const ctx = createContext({ requestId: "test-req", progress });
    expect(ctx.progress).toBe(progress);

    ctx.progress!({ type: "start", command: "test", ts: "now" });
    expect(events).toHaveLength(1);
  });
});
