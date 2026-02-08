/**
 * Tests for MCP Progress Tokens (OS-61)
 *
 * Verifies progress reporting for long-running operations.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { z } from "zod";
import {
  createMcpServer,
  defineTool,
  type ProgressReporter,
} from "../index.js";

describe("Progress Tokens", () => {
  it("handler receives progress reporter when token present", async () => {
    let receivedProgress: ProgressReporter | undefined;

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

    // Mock SDK server with progress support
    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    await server.invokeTool("long-task", {}, { progressToken: "tok-123" });

    expect(receivedProgress).toBeDefined();
    expect(typeof receivedProgress?.report).toBe("function");
  });

  it("report() sends notification with correct token", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "progress-task",
        description: "Task that reports progress updates",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          ctx.progress?.report(50, 100, "Halfway done");
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("progress-task", {}, { progressToken: "tok-456" });

    expect(notifications).toHaveLength(1);
    const notification = notifications[0] as {
      method: string;
      params: {
        progressToken: string;
        progress: number;
        total?: number;
        message?: string;
      };
    };
    expect(notification.method).toBe("notifications/progress");
    expect(notification.params.progressToken).toBe("tok-456");
    expect(notification.params.progress).toBe(50);
    expect(notification.params.total).toBe(100);
  });

  it("no reporter when no token (undefined, not null)", async () => {
    let receivedProgress: ProgressReporter | undefined;

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

  it("multiple reports work", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: unknown[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
      notification: (params: unknown) => notifications.push(params),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "multi-progress",
        description: "Task with multiple progress reports",
        inputSchema: z.object({}),
        handler: async (_input, ctx) => {
          ctx.progress?.report(25, 100);
          ctx.progress?.report(50, 100);
          ctx.progress?.report(75, 100);
          ctx.progress?.report(100, 100, "Complete");
          return Result.ok({ done: true });
        },
      })
    );

    await server.invokeTool("multi-progress", {}, { progressToken: "multi" });

    expect(notifications).toHaveLength(4);
  });
});
