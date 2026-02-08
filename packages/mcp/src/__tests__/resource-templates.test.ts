/**
 * Tests for MCP Resource Templates (OS-54)
 *
 * Verifies URI template support with RFC 6570 Level 1 matching.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import {
  createMcpServer,
  defineResource,
  defineResourceTemplate,
} from "../index.js";

describe("Resource Templates", () => {
  it("template registration and listing", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "file:///users/{userId}/profile",
        name: "User Profile",
        description: "User profile by ID",
        handler: async (uri, variables) =>
          Result.ok([{ uri, text: `Profile for ${variables.userId}` }]),
      })
    );

    const templates = server.getResourceTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].uriTemplate).toBe("file:///users/{userId}/profile");
    expect(templates[0].name).toBe("User Profile");
  });

  it("URI matching extracts variables", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}/posts/{postId}",
        name: "User Post",
        handler: async (uri, variables) =>
          Result.ok([
            {
              uri,
              text: `User ${variables.userId}, Post ${variables.postId}`,
            },
          ]),
      })
    );

    const result = await server.readResource("db:///users/alice/posts/42");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect((result.value[0] as { text: string }).text).toBe(
        "User alice, Post 42"
      );
    }
  });

  it("exact resource match takes priority over templates", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///users/admin/profile",
        name: "Admin Profile",
        handler: async () =>
          Result.ok([
            { uri: "file:///users/admin/profile", text: "exact match" },
          ]),
      })
    );

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "file:///users/{userId}/profile",
        name: "User Profile",
        handler: async (uri, variables) =>
          Result.ok([{ uri, text: `template match: ${variables.userId}` }]),
      })
    );

    const result = await server.readResource("file:///users/admin/profile");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe("exact match");
    }
  });

  it("no match returns not_found error", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "file:///users/{userId}/profile",
        name: "User Profile",
        handler: async (uri, variables) =>
          Result.ok([{ uri, text: `${variables.userId}` }]),
      })
    );

    const result = await server.readResource(
      "file:///completely/different/path"
    );
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("not found");
    }
  });

  it("multiple templates can be registered", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///users/{userId}",
        name: "User",
        handler: async (uri) => Result.ok([{ uri, text: "user" }]),
      })
    );

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "db:///posts/{postId}",
        name: "Post",
        handler: async (uri) => Result.ok([{ uri, text: "post" }]),
      })
    );

    const templates = server.getResourceTemplates();
    expect(templates).toHaveLength(2);
  });

  it("URI with regex metacharacters matches correctly", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "file:///path/to/file.txt?version={version}",
        name: "Versioned File",
        handler: async (uri, variables) =>
          Result.ok([{ uri, text: `v${variables.version}` }]),
      })
    );

    const result = await server.readResource(
      "file:///path/to/file.txt?version=2"
    );
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect((result.value[0] as { text: string }).text).toBe("v2");
    }

    // Should NOT match a URI where the dot matches any character
    const noMatch = await server.readResource(
      "file:///path/to/fileXtxt?version=2"
    );
    expect(noMatch.isErr()).toBe(true);
  });

  it("template with mimeType is included in listing", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResourceTemplate(
      defineResourceTemplate({
        uriTemplate: "file:///docs/{docId}",
        name: "Document",
        mimeType: "application/json",
        handler: async (uri) => Result.ok([{ uri, text: "{}" }]),
      })
    );

    const templates = server.getResourceTemplates();
    expect(templates[0].mimeType).toBe("application/json");
  });
});
