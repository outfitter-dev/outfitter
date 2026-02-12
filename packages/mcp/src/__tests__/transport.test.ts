/**
 * Tests for MCP Transport Layer
 *
 * Verifies that createSdkServer correctly advertises capabilities
 * and supports runtime registration of resources/prompts.
 */
import { describe, expect, it } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Result } from "@outfitter/contracts";
import { z } from "zod";
import { createMcpServer, defineTool } from "../index.js";
import { createSdkServer } from "../transport.js";

describe("createSdkServer", () => {
  it("creates SDK server for tools-only server without throwing", () => {
    const server = createMcpServer({
      name: "tools-only",
      version: "1.0.0",
    });

    server.registerTool(
      defineTool({
        name: "echo",
        description: "Echo the input message back",
        inputSchema: z.object({ message: z.string() }),
        handler: async (input) => {
          const { Result } = await import("@outfitter/contracts");
          return Result.ok({ echo: input.message });
        },
      })
    );

    // Should not throw — no resource/prompt handlers registered
    // when no resources/prompts exist
    expect(() => createSdkServer(server)).not.toThrow();
  });

  it("creates SDK server with resource handlers when resources are registered", () => {
    const server = createMcpServer({
      name: "with-resources",
      version: "1.0.0",
    });

    server.registerResource({
      uri: "file:///config.json",
      name: "Config",
      description: "Application configuration",
    });

    expect(() => createSdkServer(server)).not.toThrow();
  });

  it("creates SDK server with prompt handlers when prompts are registered", async () => {
    const { Result } = await import("@outfitter/contracts");

    const server = createMcpServer({
      name: "with-prompts",
      version: "1.0.0",
    });

    server.registerPrompt({
      name: "review",
      description: "Code review prompt",
      arguments: [{ name: "language", required: true }],
      handler: async () =>
        Result.ok({
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: "Review this code" },
            },
          ],
        }),
    });

    expect(() => createSdkServer(server)).not.toThrow();
  });

  it("advertises resources and prompts capabilities even when initially empty", () => {
    const server = createMcpServer({
      name: "dynamic-capabilities",
      version: "1.0.0",
    });

    const sdkServer = createSdkServer(server);
    const capabilities = sdkServer.getCapabilities();

    expect(capabilities.resources).toBeDefined();
    expect(capabilities.prompts).toBeDefined();
  });

  it("supports resources and prompts registered after SDK server creation", async () => {
    const server = createMcpServer({
      name: "dynamic-registration",
      version: "1.0.0",
    });

    const sdkServer = createSdkServer(server);
    const client = new Client(
      { name: "transport-test-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      sdkServer.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const initialResources = await client.listResources();
    const initialPrompts = await client.listPrompts();
    expect(initialResources.resources).toEqual([]);
    expect(initialPrompts.prompts).toEqual([]);

    server.registerResource({
      uri: "file:///dynamic.txt",
      name: "Dynamic resource",
      handler: async () =>
        Result.ok([{ uri: "file:///dynamic.txt", text: "dynamic content" }]),
    });

    server.registerPrompt({
      name: "dynamic-prompt",
      description: "Dynamic prompt",
      arguments: [],
      handler: async () =>
        Result.ok({
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: "dynamic prompt body" },
            },
          ],
        }),
    });

    const listedResources = await client.listResources();
    const listedPrompts = await client.listPrompts();
    expect(listedResources.resources.map((r) => r.uri)).toContain(
      "file:///dynamic.txt"
    );
    expect(listedPrompts.prompts.map((p) => p.name)).toContain(
      "dynamic-prompt"
    );

    const readResult = await client.readResource({
      uri: "file:///dynamic.txt",
    });
    expect(readResult.contents).toHaveLength(1);
    expect(readResult.contents[0]?.uri).toBe("file:///dynamic.txt");
    expect((readResult.contents[0] as { text?: string }).text).toBe(
      "dynamic content"
    );

    const promptResult = await client.getPrompt({
      name: "dynamic-prompt",
      arguments: {},
    });
    expect(promptResult.messages).toHaveLength(1);
    expect(promptResult.messages[0]?.content.type).toBe("text");
    expect((promptResult.messages[0]?.content as { text?: string }).text).toBe(
      "dynamic prompt body"
    );

    await Promise.all([client.close(), sdkServer.close()]);
  });
});
