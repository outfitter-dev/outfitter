/**
 * Tests for MCP Prompts (OS-55)
 *
 * Verifies the full prompt system: registration, listing, invocation.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { createMcpServer, definePrompt } from "../index.js";

describe("Prompts", () => {
  it("registration and listing", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "greet",
        description: "Generate a greeting",
        arguments: [
          { name: "name", description: "Person to greet", required: true },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Hello, ${args.name}!`,
                },
              },
            ],
          }),
      })
    );

    const prompts = server.getPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe("greet");
    expect(prompts[0].description).toBe("Generate a greeting");
    expect(prompts[0].arguments).toHaveLength(1);
  });

  it("invocation with args returns messages", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "summarize",
        description: "Summarize a topic in a given style",
        arguments: [
          { name: "topic", description: "Topic to summarize", required: true },
          { name: "style", description: "Writing style" },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Summarize ${args.topic} in ${args.style ?? "default"} style`,
                },
              },
            ],
          }),
      })
    );

    const result = await server.getPrompt("summarize", {
      topic: "AI",
      style: "casual",
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.messages).toHaveLength(1);
      expect(result.value.messages[0].content.text).toBe(
        "Summarize AI in casual style"
      );
    }
  });

  it("missing required arg returns validation McpError", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "greet",
        description: "Generate a greeting",
        arguments: [
          { name: "name", description: "Person to greet", required: true },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Hello, ${args.name}!`,
                },
              },
            ],
          }),
      })
    );

    const result = await server.getPrompt("greet", {});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("name");
    }
  });

  it("unknown prompt returns not_found McpError", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const result = await server.getPrompt("nonexistent", {});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("not found");
    }
  });

  it("multi-message responses work", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "chat",
        description: "Multi-turn chat prompt",
        arguments: [],
        handler: async () =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: { type: "text" as const, text: "What is 2+2?" },
              },
              {
                role: "assistant" as const,
                content: { type: "text" as const, text: "4" },
              },
              {
                role: "user" as const,
                content: { type: "text" as const, text: "And 3+3?" },
              },
            ],
          }),
      })
    );

    const result = await server.getPrompt("chat", {});
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.messages).toHaveLength(3);
      expect(result.value.messages[0].role).toBe("user");
      expect(result.value.messages[1].role).toBe("assistant");
    }
  });

  it("prompt with no arguments", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "hello",
        description: "Simple hello prompt",
        arguments: [],
        handler: async () =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: { type: "text" as const, text: "Hello world!" },
              },
            ],
          }),
      })
    );

    const result = await server.getPrompt("hello", {});
    expect(result.isOk()).toBe(true);
  });

  it("optional args are not required", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "greet",
        description: "Greeting with optional title",
        arguments: [
          { name: "name", description: "Person name", required: true },
          { name: "title", description: "Optional title" },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Hello, ${args.title ? `${args.title} ` : ""}${args.name}!`,
                },
              },
            ],
          }),
      })
    );

    // Should succeed without optional "title" arg
    const result = await server.getPrompt("greet", { name: "Alice" });
    expect(result.isOk()).toBe(true);
  });
});
