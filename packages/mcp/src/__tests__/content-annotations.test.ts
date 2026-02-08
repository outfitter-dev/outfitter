/**
 * Tests for MCP Content Annotations (OS-58)
 *
 * Verifies audience and priority annotations on content.
 */
import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import {
  type ContentAnnotations,
  createMcpServer,
  definePrompt,
  defineResource,
} from "../index.js";

describe("Content Annotations", () => {
  it("annotations preserved on resource content", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///annotated.txt",
        name: "Annotated Resource",
        handler: async () =>
          Result.ok([
            {
              uri: "file:///annotated.txt",
              text: "important content",
              annotations: {
                audience: ["user", "assistant"],
                priority: 0.9,
              },
            },
          ]),
      })
    );

    const result = await server.readResource("file:///annotated.txt");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const content = result.value[0] as {
        text: string;
        annotations?: ContentAnnotations;
      };
      expect(content.annotations).toBeDefined();
      expect(content.annotations?.audience).toEqual(["user", "assistant"]);
      expect(content.annotations?.priority).toBe(0.9);
    }
  });

  it("annotations preserved on prompt messages", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerPrompt(
      definePrompt({
        name: "annotated",
        description: "Prompt with annotated content",
        arguments: [],
        handler: async () =>
          Result.ok({
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: "Important prompt",
                  annotations: {
                    audience: ["assistant"],
                    priority: 1.0,
                  },
                },
              },
            ],
          }),
      })
    );

    const result = await server.getPrompt("annotated", {});
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const content = result.value.messages[0].content as {
        text: string;
        annotations?: ContentAnnotations;
      };
      expect(content.annotations).toBeDefined();
      expect(content.annotations?.audience).toEqual(["assistant"]);
      expect(content.annotations?.priority).toBe(1.0);
    }
  });

  it("missing annotations omitted (not null)", async () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.registerResource(
      defineResource({
        uri: "file:///plain.txt",
        name: "Plain Resource",
        handler: async () =>
          Result.ok([{ uri: "file:///plain.txt", text: "plain content" }]),
      })
    );

    const result = await server.readResource("file:///plain.txt");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const content = result.value[0] as {
        text: string;
        annotations?: ContentAnnotations;
      };
      expect(content.annotations).toBeUndefined();
    }
  });

  it("ContentAnnotations type allows partial specification", () => {
    const partial: ContentAnnotations = {
      priority: 0.5,
    };
    expect(partial.priority).toBe(0.5);
    expect(partial.audience).toBeUndefined();
  });
});
