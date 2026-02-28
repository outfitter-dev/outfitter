/**
 * Tests for MCP Progress Adapter (OS-354 part 3)
 *
 * Verifies that ctx.progress (ProgressCallback) translates StreamEvent
 * to MCP notifications/progress when a progressToken is present,
 * and that ctx.progress is undefined when no token is provided.
 */
import { describe, expect, it } from "bun:test";

import type { ProgressCallback, StreamEvent } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";
import { z } from "zod";

import { createMcpServer, defineTool } from "../index.js";
import { createMcpProgressCallback } from "../progress.js";

// =============================================================================
// Unit Tests: createMcpProgressCallback
// =============================================================================

describe("createMcpProgressCallback", () => {
  it("returns a ProgressCallback function", () => {
    const cb = createMcpProgressCallback("tok-1", () => {});
    expect(typeof cb).toBe("function");
  });

  it("emits notification for start event", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-start", (n: unknown) =>
      notifications.push(n)
    );

    const event: StreamEvent = {
      type: "start",
      command: "deploy",
      ts: "2026-01-01T00:00:00.000Z",
    };
    cb(event);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      method: "notifications/progress",
      params: {
        progressToken: "tok-start",
        progress: 0,
        message: "[start] deploy",
      },
    });
  });

  it("emits notification for step event", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-step", (n: unknown) =>
      notifications.push(n)
    );

    const event: StreamEvent = {
      type: "step",
      name: "scanning files",
      status: "complete",
      duration_ms: 42,
    };
    cb(event);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      method: "notifications/progress",
      params: {
        progressToken: "tok-step",
        progress: 0,
        message: "[step] scanning files: complete (42ms)",
      },
    });
  });

  it("emits notification for step event without duration", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-step2", (n: unknown) =>
      notifications.push(n)
    );

    const event: StreamEvent = {
      type: "step",
      name: "initializing",
      status: "running",
    };
    cb(event);

    const notification = notifications[0] as {
      params: { message: string };
    };
    expect(notification.params.message).toBe("[step] initializing: running");
  });

  it("emits notification for progress event with current/total", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-prog", (n: unknown) =>
      notifications.push(n)
    );

    const event: StreamEvent = {
      type: "progress",
      current: 5,
      total: 10,
      message: "Processing file 5 of 10",
    };
    cb(event);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      method: "notifications/progress",
      params: {
        progressToken: "tok-prog",
        progress: 5,
        total: 10,
        message: "Processing file 5 of 10",
      },
    });
  });

  it("emits notification for progress event without message", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-prog2", (n: unknown) =>
      notifications.push(n)
    );

    const event: StreamEvent = {
      type: "progress",
      current: 3,
      total: 8,
    };
    cb(event);

    const notification = notifications[0] as {
      params: { progress: number; total: number; message?: string };
    };
    expect(notification.params.progress).toBe(3);
    expect(notification.params.total).toBe(8);
    // No message field when event has no message
    expect(notification.params.message).toBeUndefined();
  });

  it("supports numeric progressToken", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback(42, (n: unknown) =>
      notifications.push(n)
    );

    cb({ type: "progress", current: 1, total: 5 });

    const notification = notifications[0] as {
      params: { progressToken: number };
    };
    expect(notification.params.progressToken).toBe(42);
  });

  it("emits multiple notifications in order", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-multi", (n: unknown) =>
      notifications.push(n)
    );

    cb({
      type: "start",
      command: "check",
      ts: "2026-01-01T00:00:00.000Z",
    });
    cb({ type: "progress", current: 1, total: 3 });
    cb({ type: "progress", current: 2, total: 3 });
    cb({ type: "progress", current: 3, total: 3 });
    cb({
      type: "step",
      name: "done",
      status: "complete",
    });

    expect(notifications).toHaveLength(5);
  });

  it("keeps progress monotonic across step events after numeric progress", () => {
    const notifications: unknown[] = [];
    const cb = createMcpProgressCallback("tok-monotonic", (n: unknown) =>
      notifications.push(n)
    );

    cb({ type: "progress", current: 7, total: 10 });
    cb({
      type: "step",
      name: "post-processing",
      status: "running",
    });

    expect(notifications).toHaveLength(2);
    const stepNotification = notifications[1] as {
      params: { progress: number; message: string };
    };
    expect(stepNotification.params.progress).toBe(7);
    expect(stepNotification.params.message).toContain("post-processing");
  });
});

// =============================================================================
// Integration Tests: server.ts wiring
// =============================================================================

describe("MCP Progress Integration", () => {
  it("ctx.progress is a ProgressCallback when progressToken present", async () => {
    let receivedProgress: ProgressCallback | undefined;

    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "long-task",
        description: "A long-running task with progress reporting",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          receivedProgress = ctx.progress;
          return Result.ok({ done: true });
        },
      })
    );

    // Mock SDK server with notification support
    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {},
      sendResourceListChanged: () => {},
      sendPromptListChanged: () => {},
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    await server.invokeTool("long-task", {}, { progressToken: "tok-123" });

    expect(receivedProgress).toBeDefined();
    expect(typeof receivedProgress).toBe("function");
  });

  it("ctx.progress emits notifications/progress for StreamEvent calls", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {},
      sendResourceListChanged: () => {},
      sendPromptListChanged: () => {},
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "progress-task",
        description: "Task that reports progress updates via StreamEvent",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          ctx.progress?.({
            type: "start",
            command: "progress-task",
            ts: new Date().toISOString(),
          });
          ctx.progress?.({
            type: "progress",
            current: 50,
            total: 100,
            message: "Halfway done",
          });
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("progress-task", {}, { progressToken: "tok-456" });

    expect(notifications).toHaveLength(2);

    // First notification: start event
    const startNotification = notifications[0] as {
      method: string;
      params: { progressToken: string; progress: number; message: string };
    };
    expect(startNotification.method).toBe("notifications/progress");
    expect(startNotification.params.progressToken).toBe("tok-456");

    // Second notification: progress event
    const progressNotification = notifications[1] as {
      method: string;
      params: {
        progressToken: string;
        progress: number;
        total: number;
        message: string;
      };
    };
    expect(progressNotification.method).toBe("notifications/progress");
    expect(progressNotification.params.progressToken).toBe("tok-456");
    expect(progressNotification.params.progress).toBe(50);
    expect(progressNotification.params.total).toBe(100);
    expect(progressNotification.params.message).toBe("Halfway done");
  });

  it("ctx.progress is undefined when no progressToken", async () => {
    let receivedProgress: ProgressCallback | undefined;

    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "no-progress",
        description: "Task without progress token support",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          receivedProgress = ctx.progress;
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("no-progress", {});
    expect(receivedProgress).toBeUndefined();
  });

  it("no notifications emitted when no progressToken", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {},
      sendResourceListChanged: () => {},
      sendPromptListChanged: () => {},
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "silent-task",
        description: "Task that tries to call progress but gets undefined",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          // progress is undefined — no notifications should be emitted
          ctx.progress?.({
            type: "progress",
            current: 1,
            total: 10,
          });
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("silent-task", {});
    expect(notifications).toHaveLength(0);
  });

  it("multiple StreamEvent progress calls emit ordered notifications", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {},
      sendResourceListChanged: () => {},
      sendPromptListChanged: () => {},
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "multi-progress",
        description: "Task with multiple progress reports via StreamEvent",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          ctx.progress?.({
            type: "start",
            command: "multi-progress",
            ts: new Date().toISOString(),
          });
          ctx.progress?.({ type: "progress", current: 25, total: 100 });
          ctx.progress?.({ type: "progress", current: 50, total: 100 });
          ctx.progress?.({ type: "progress", current: 75, total: 100 });
          ctx.progress?.({
            type: "step",
            name: "finalize",
            status: "complete",
          });
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("multi-progress", {}, { progressToken: "multi" });

    expect(notifications).toHaveLength(5);

    // All notifications should be notifications/progress
    for (const n of notifications) {
      expect((n as { method: string }).method).toBe("notifications/progress");
      expect(
        (n as { params: { progressToken: string } }).params.progressToken
      ).toBe("multi");
    }
  });

  it("ctx.progress is undefined when no SDK server is bound", async () => {
    let receivedProgress: ProgressCallback | undefined;

    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Don't bind SDK server
    server.registerTool(
      defineTool({
        name: "unbound-task",
        description: "Task invoked without SDK server binding",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          receivedProgress = ctx.progress;
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("unbound-task", {}, { progressToken: "tok-789" });
    expect(receivedProgress).toBeUndefined();
  });
});
