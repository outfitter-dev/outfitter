/**
 * Tests for defineResource() and defineResourceTemplate() convenience functions [OS-349]
 *
 * Verifies:
 * - defineResource() typed convenience wrapper
 * - defineResourceTemplate() with Zod schema validation for URI template parameters
 * - Schema validation runs before handler invocation
 * - Integration with createMcpServer() registration and reading
 * - Framework error handling and logging
 */
import { describe, expect, it } from "bun:test";

import { Result } from "@outfitter/contracts";
import { z } from "zod";

import {
  createMcpServer,
  defineResource,
  defineResourceTemplate,
} from "../index.js";

// ============================================================================
// defineResource() — Typed Convenience Wrapper
// ============================================================================

describe("defineResource() typed wrapper", () => {
  it("returns the resource definition unchanged (backward compat)", () => {
    const resource = defineResource({
      uri: "file:///config.json",
      name: "Config",
      description: "Application configuration",
      mimeType: "application/json",
    });

    expect(resource.uri).toBe("file:///config.json");
    expect(resource.name).toBe("Config");
    expect(resource.description).toBe("Application configuration");
    expect(resource.mimeType).toBe("application/json");
  });

  it("works with handler for readable resources", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///data.json",
        name: "Data",
        handler: async (uri, _ctx) =>
          Result.ok([{ uri, text: '{"key":"value"}' }]),
      })
    );

    const result = await server.readResource("file:///data.json");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect((result.value[0] as { text: string }).text).toBe(
        '{"key":"value"}'
      );
    }
  });
});

// ============================================================================
// defineResourceTemplate() with Zod Schema Validation
// ============================================================================

describe("defineResourceTemplate() with Zod schema", () => {
  it("accepts paramSchema and validates template variables before handler", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    let receivedParams: unknown;

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User",
        paramSchema: z.object({
          userId: z.string().min(1),
        }),
        handler: async (uri, params, _ctx) => {
          receivedParams = params;
          return Result.ok([{ uri, text: `User: ${params.userId}` }]);
        },
      })
    );

    const result = await server.readResource("db:///users/alice");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe("User: alice");
    }
    expect(receivedParams).toEqual({ userId: "alice" });
  });

  it("returns validation error when template variables fail schema", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    let handlerCalled = false;

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///items/{itemId}",
        name: "Item",
        paramSchema: z.object({
          itemId: z.string().uuid(),
        }),
        handler: async (uri, _params, _ctx) => {
          handlerCalled = true;
          return Result.ok([{ uri, text: "item" }]);
        },
      })
    );

    // "not-a-uuid" won't pass z.string().uuid()
    const result = await server.readResource("db:///items/not-a-uuid");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("Invalid");
    }
    expect(handlerCalled).toBe(false);
  });

  it("supports coercion in paramSchema (e.g. z.coerce.number())", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    let receivedParams: unknown;

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///pages/{page}",
        name: "Page",
        paramSchema: z.object({
          page: z.coerce.number().int().positive(),
        }),
        handler: async (uri, params, _ctx) => {
          receivedParams = params;
          return Result.ok([{ uri, text: `Page ${params.page}` }]);
        },
      })
    );

    const result = await server.readResource("db:///pages/42");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe("Page 42");
    }
    // Number coercion: "42" → 42
    expect(receivedParams).toEqual({ page: 42 });
  });

  it("handler receives HandlerContext with requestId and logger", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    let receivedRequestId: string | undefined;
    let receivedLogger: unknown;

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///docs/{docId}",
        name: "Document",
        paramSchema: z.object({
          docId: z.string(),
        }),
        handler: async (uri, _params, ctx) => {
          receivedRequestId = ctx.requestId;
          receivedLogger = ctx.logger;
          return Result.ok([{ uri, text: "doc content" }]);
        },
      })
    );

    await server.readResource("db:///docs/readme");
    expect(receivedRequestId).toBeDefined();
    expect(receivedLogger).toBeDefined();
  });

  it("handler errors are translated to McpError", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///files/{fileId}",
        name: "File",
        paramSchema: z.object({
          fileId: z.string(),
        }),
        handler: async () => {
          throw new Error("disk read failed");
        },
      })
    );

    const result = await server.readResource("db:///files/abc");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("McpError");
      expect(result.error.message).toContain("disk read failed");
    }
  });

  it("multiple template variables are all validated", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}/posts/{postId}",
        name: "User Post",
        paramSchema: z.object({
          userId: z.string().min(1),
          postId: z.coerce.number().int().positive(),
        }),
        handler: async (uri, params, _ctx) =>
          Result.ok([
            { uri, text: `User ${params.userId}, Post ${params.postId}` },
          ]),
      })
    );

    const result = await server.readResource("db:///users/alice/posts/7");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe(
        "User alice, Post 7"
      );
    }
  });

  it("completion handlers are preserved when using paramSchema", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User",
        paramSchema: z.object({
          userId: z.string(),
        }),
        complete: {
          userId: async (value) => ({
            values: [`${value}-1`, `${value}-2`],
          }),
        },
        handler: async (uri, _params, _ctx) =>
          Result.ok([{ uri, text: "content" }]),
      })
    );

    const templates = server.getResourceTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].complete).toBeDefined();
    expect(typeof templates[0].complete?.["userId"]).toBe("function");
  });
});

// ============================================================================
// defineResourceTemplate() without schema (backward compat)
// ============================================================================

describe("defineResourceTemplate() backward compatibility", () => {
  it("works without paramSchema (existing behavior)", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///items/{itemId}",
        name: "Item",
        handler: async (uri, variables, _ctx) =>
          Result.ok([{ uri, text: `Item: ${variables.itemId}` }]),
      })
    );

    const result = await server.readResource("db:///items/xyz");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe("Item: xyz");
    }
  });

  it("listing works for both schema and non-schema templates", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///items/{itemId}",
        name: "Item (untyped)",
        handler: async (uri) => Result.ok([{ uri, text: "untyped" }]),
      })
    );

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User (typed)",
        paramSchema: z.object({ userId: z.string() }),
        handler: async (uri, _params, _ctx) =>
          Result.ok([{ uri, text: "typed" }]),
      })
    );

    const templates = server.getResourceTemplates();
    expect(templates).toHaveLength(2);
  });
});

// ============================================================================
// Integration: defineResource() + defineResourceTemplate() with server
// ============================================================================

describe("Integration: resources with createMcpServer()", () => {
  it("static resource takes priority over template match", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "db:///users/admin",
        name: "Admin User",
        handler: async (uri) =>
          Result.ok([{ uri, text: "exact match: admin" }]),
      })
    );

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User",
        paramSchema: z.object({ userId: z.string() }),
        handler: async (uri, params, _ctx) =>
          Result.ok([{ uri, text: `template match: ${params.userId}` }]),
      })
    );

    // Exact match should win
    const result = await server.readResource("db:///users/admin");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe(
        "exact match: admin"
      );
    }

    // Template match for non-exact URIs
    const templateResult = await server.readResource("db:///users/bob");
    expect(templateResult.isOk()).toBe(true);
    if (templateResult.isOk()) {
      expect((templateResult.value[0] as { text: string }).text).toBe(
        "template match: bob"
      );
    }
  });

  it("getResources() and getResourceTemplates() return registered items", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///config.json",
        name: "Config",
      })
    );

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///records/{id}",
        name: "Record",
        paramSchema: z.object({ id: z.string() }),
        handler: async (uri, _params, _ctx) =>
          Result.ok([{ uri, text: "record" }]),
      })
    );

    expect(server.getResources()).toHaveLength(1);
    expect(server.getResourceTemplates()).toHaveLength(1);
  });
});
