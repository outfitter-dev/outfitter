/**
 * Tests for MCP Resource Read Handlers (OS-53)
 *
 * Verifies that resources can have read handlers that return content.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { createMcpServer, defineResource } from "../index.js";

describe("Resource Read Handlers", () => {
  it("resource with handler returns text content", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///config.json",
        name: "Config",
        description: "Application configuration",
        mimeType: "application/json",
        handler: async () =>
          Result.ok([{ uri: "file:///config.json", text: '{"key":"value"}' }]),
      })
    );

    const result = await server.readResource("file:///config.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].uri).toBe("file:///config.json");
      expect((result.value[0] as { text: string }).text).toBe(
        '{"key":"value"}'
      );
    }
  });

  it("resource with handler returns blob content", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///image.png",
        name: "Image",
        mimeType: "image/png",
        handler: async () =>
          Result.ok([
            {
              uri: "file:///image.png",
              blob: "iVBORw0KGgoAAAANSUhEUg==",
              mimeType: "image/png",
            },
          ]),
      })
    );

    const result = await server.readResource("file:///image.png");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect((result.value[0] as { blob: string }).blob).toBe(
        "iVBORw0KGgoAAAANSUhEUg=="
      );
    }
  });

  it("unknown URI returns not_found McpError", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const result = await server.readResource("file:///nonexistent");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("not found");
    }
  });

  it("metadata-only resource returns not readable error", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///metadata-only.txt",
        name: "Metadata Only",
      })
    );

    const result = await server.readResource("file:///metadata-only.txt");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("not readable");
    }
  });

  it("handler errors translate to McpError", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///error.txt",
        name: "Error Resource",
        handler: async () => {
          throw new Error("disk read failed");
        },
      })
    );

    const result = await server.readResource("file:///error.txt");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("disk read failed");
    }
  });

  it("handler receives context with requestId and logger", async () => {
    let receivedRequestId: string | undefined;
    let receivedLogger: unknown;

    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///ctx.txt",
        name: "Context Resource",
        handler: async (_uri, ctx) => {
          receivedRequestId = ctx.requestId;
          receivedLogger = ctx.logger;
          return Result.ok([{ uri: "file:///ctx.txt", text: "content" }]);
        },
      })
    );

    await server.readResource("file:///ctx.txt");
    expect(receivedRequestId).toBeDefined();
    expect(receivedLogger).toBeDefined();
  });

  it("resources stored by URI are deduplicated", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({ uri: "file:///dup.txt", name: "First" })
    );
    server.registerResource(
      defineResource({ uri: "file:///dup.txt", name: "Second" })
    );

    const resources = server.getResources();
    expect(resources).toHaveLength(1);
    expect(resources[0].name).toBe("Second");
  });

  it("multiple resources are listed correctly", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({ uri: "file:///a.txt", name: "A" })
    );
    server.registerResource(
      defineResource({ uri: "file:///b.txt", name: "B" })
    );

    const resources = server.getResources();
    expect(resources).toHaveLength(2);
  });
});
