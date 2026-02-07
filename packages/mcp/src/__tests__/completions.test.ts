/**
 * Tests for MCP Completions (OS-56)
 *
 * Verifies argument autocompletion for prompt args and resource template params.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import {
  createMcpServer,
  definePrompt,
  defineResourceTemplate,
} from "../index.js";

describe("Completions", () => {
  it("prompt argument completion works", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "greet",
        description: "Greeting prompt",
        arguments: [
          {
            name: "language",
            description: "Language",
            required: true,
            complete: async (value) => ({
              values: ["english", "spanish", "french"].filter((l) =>
                l.startsWith(value)
              ),
            }),
          },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `Hello in ${args.language}`,
                },
              },
            ],
          }),
      })
    );

    const result = await server.complete(
      { type: "ref/prompt", name: "greet" },
      "language",
      "sp"
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.values).toEqual(["spanish"]);
    }
  });

  it("resource template parameter completion works", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User",
        complete: {
          userId: async (value) => ({
            values: ["alice", "bob", "charlie"].filter((u) =>
              u.startsWith(value)
            ),
          }),
        },
        handler: async (uri) => Result.ok([{ uri, text: "user" }]),
      })
    );

    const result = await server.complete(
      { type: "ref/resource", uri: "db:///users/{userId}" },
      "userId",
      "a"
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.values).toEqual(["alice"]);
    }
  });

  it("missing handler returns empty values", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "basic",
        description: "Basic prompt",
        arguments: [{ name: "name", description: "Name", required: true }],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: { type: "text" as const, text: `${args.name}` },
              },
            ],
          }),
      })
    );

    const result = await server.complete(
      { type: "ref/prompt", name: "basic" },
      "name",
      "a"
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.values).toEqual([]);
    }
  });

  it("async handlers work", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "async-prompt",
        description: "Async prompt",
        arguments: [
          {
            name: "city",
            description: "City",
            complete: async (value) => {
              // Simulate async lookup
              await new Promise((resolve) => setTimeout(resolve, 1));
              return {
                values: ["New York", "Nashville"].filter((c) =>
                  c.toLowerCase().startsWith(value.toLowerCase())
                ),
              };
            },
          },
        ],
        handler: async (args) =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: { type: "text" as const, text: `${args.city}` },
              },
            ],
          }),
      })
    );

    const result = await server.complete(
      { type: "ref/prompt", name: "async-prompt" },
      "city",
      "n"
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.values).toEqual(["New York", "Nashville"]);
    }
  });

  it("unknown prompt returns error", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const result = await server.complete(
      { type: "ref/prompt", name: "nonexistent" },
      "arg",
      "val"
    );
    expect(result.isErr()).toBe(true);
  });

  it("unknown resource template returns error", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const result = await server.complete(
      { type: "ref/resource", uri: "db:///unknown/{id}" },
      "id",
      "val"
    );
    expect(result.isErr()).toBe(true);
  });
});
