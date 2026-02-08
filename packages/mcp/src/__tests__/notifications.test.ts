/**
 * Tests for MCP List Changed Notifications (OS-59)
 *
 * Verifies notifications for tools, resources, and prompts changes.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { z } from "zod";
import {
  createMcpServer,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
} from "../index.js";

describe("List Changed Notifications", () => {
  it("notifyToolsChanged is callable", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Should not throw even without SDK server bound
    expect(() => server.notifyToolsChanged()).not.toThrow();
  });

  it("notifyResourcesChanged is callable", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    expect(() => server.notifyResourcesChanged()).not.toThrow();
  });

  it("notifyPromptsChanged is callable", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    expect(() => server.notifyPromptsChanged()).not.toThrow();
  });

  it("no-op before binding (no crash)", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // All should be safe to call without SDK server
    server.notifyToolsChanged();
    server.notifyResourcesChanged();
    server.notifyPromptsChanged();
  });

  it("auto-notify on tool registration after binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => notifications.push("tools"),
      sendResourceListChanged: () => notifications.push("resources"),
      sendPromptListChanged: () => notifications.push("prompts"),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerTool(
      defineTool({
        name: "dynamic-tool",
        description: "A dynamically registered tool for testing",
        inputSchema: z.object({}),
        handler: async () => Result.ok({}),
      })
    );

    expect(notifications).toContain("tools");
  });

  it("auto-notify on resource registration after binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => notifications.push("tools"),
      sendResourceListChanged: () => notifications.push("resources"),
      sendPromptListChanged: () => notifications.push("prompts"),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerResource(
      defineResource({
        uri: "file:///dynamic.txt",
        name: "Dynamic Resource",
      })
    );

    expect(notifications).toContain("resources");
  });

  it("auto-notify on prompt registration after binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => notifications.push("tools"),
      sendResourceListChanged: () => notifications.push("resources"),
      sendPromptListChanged: () => notifications.push("prompts"),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerPrompt(
      definePrompt({
        name: "dynamic-prompt",
        description: "A dynamically registered prompt",
        arguments: [],
        handler: async () =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: { type: "text" as const, text: "hello" },
              },
            ],
          }),
      })
    );

    expect(notifications).toContain("prompts");
  });

  it("auto-notify on resource template registration after binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendToolListChanged: () => notifications.push("tools"),
      sendResourceListChanged: () => notifications.push("resources"),
      sendPromptListChanged: () => notifications.push("prompts"),
    };

    server.bindSdkServer?.(mockSdkServer);

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///items/{itemId}",
        name: "Item",
        handler: async (uri) => Result.ok([{ uri, text: "item" }]),
      })
    );

    expect(notifications).toContain("resources");
  });

  it("no notification before binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Should not throw when registering before binding
    server.registerTool(
      defineTool({
        name: "early-tool",
        description: "Tool registered before SDK binding",
        inputSchema: z.object({}),
        handler: async () => Result.ok({}),
      })
    );

    // No way to verify notification wasn't sent, but at least it shouldn't crash
  });
});
