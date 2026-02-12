/**
 * @outfitter/mcp - Transport Helpers
 *
 * Bridges the @outfitter/mcp server with the MCP SDK transports.
 * v0.1-rc supports explicit stdio transport.
 *
 * @packageDocumentation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  McpError as SdkMcpError,
  SetLevelRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { safeStringify } from "@outfitter/contracts";
import type { McpLogLevel } from "./logging.js";
import type { McpServer } from "./types.js";

export type McpToolResponse = CallToolResult;

function isMcpToolResponse(value: unknown): value is McpToolResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const content = (value as { content?: unknown }).content;
  return Array.isArray(content);
}

function toTextPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return safeStringify(value);
}

interface ErrorRecord {
  _tag?: unknown;
  message?: unknown;
  code?: unknown;
  context?: unknown;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const record = error as ErrorRecord;
    return {
      _tag: record._tag ?? "McpError",
      message: record.message ?? "Unknown error",
      code: record.code,
      context: record.context,
    };
  }

  return {
    _tag: "McpError",
    message: String(error),
  };
}

/**
 * Wrap a handler success value into an MCP CallToolResult.
 *
 * If the value is already a valid McpToolResponse (has a `content` array),
 * it is returned as-is. Otherwise it is wrapped in a text content block.
 * Plain objects are also attached as `structuredContent` for SDK clients
 * that support structured output.
 */
export function wrapToolResult(value: unknown): McpToolResponse {
  if (isMcpToolResponse(value)) {
    return value;
  }

  const structuredContent =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;

  return {
    content: [
      {
        type: "text",
        text: toTextPayload(value),
      },
    ],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

/**
 * Wrap an error into an MCP CallToolResult with `isError: true`.
 *
 * Serializes the error (preserving `_tag`, `message`, `code`, `context` if
 * present) and wraps it as a text content block.
 */
export function wrapToolError(error: unknown): McpToolResponse {
  return {
    content: [
      {
        type: "text",
        text: toTextPayload(serializeError(error)),
      },
    ],
    isError: true,
  };
}

/**
 * Convert an Outfitter McpError to the SDK's McpError,
 * preserving the JSON-RPC error code and context.
 */
function toSdkError(error: {
  message: string;
  code: number;
  context?: Record<string, unknown>;
}): SdkMcpError {
  return new SdkMcpError(error.code, error.message, error.context);
}

/**
 * Create an MCP SDK server from an Outfitter MCP server.
 */
export function createSdkServer(server: McpServer): Server {
  // Advertise capabilities that this server implementation supports.
  // Resources/prompts may start empty and be registered at runtime.
  const capabilities: Record<string, Record<string, unknown>> = {
    tools: { listChanged: true },
    resources: { listChanged: true, subscribe: true },
    prompts: { listChanged: true },
    completions: {},
    logging: {},
  };

  const sdkServer = new Server(
    { name: server.name, version: server.version },
    { capabilities }
  );

  // Tool handlers (always registered — tools capability is always advertised)
  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: server.getTools(),
  }));

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const progressToken = (
      request.params as { _meta?: { progressToken?: string | number } }
    )._meta?.progressToken;
    const options = progressToken !== undefined ? { progressToken } : undefined;
    const result = await server.invokeTool(
      name,
      (args ?? {}) as Record<string, unknown>,
      options
    );

    if (result.isErr()) {
      return wrapToolError(result.error);
    }

    return wrapToolResult(result.value);
  });

  // Resource handlers
  sdkServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: server.getResources().map((r) => ({
      uri: r.uri,
      name: r.name,
      ...(r.description ? { description: r.description } : {}),
      ...(r.mimeType ? { mimeType: r.mimeType } : {}),
    })),
  }));

  sdkServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: server.getResourceTemplates().map((t) => ({
      uriTemplate: t.uriTemplate,
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      ...(t.mimeType ? { mimeType: t.mimeType } : {}),
    })),
  }));

  sdkServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const result = await server.readResource(uri);

    if (result.isErr()) {
      throw toSdkError(result.error);
    }

    return { contents: result.value };
  });

  // Subscription handlers (resource feature)
  sdkServer.setRequestHandler(
    SubscribeRequestSchema,
    // biome-ignore lint/suspicious/useAwait: protocol requires async
    async (request) => {
      server.subscribe(request.params.uri);
      return {};
    }
  );

  sdkServer.setRequestHandler(
    UnsubscribeRequestSchema,
    // biome-ignore lint/suspicious/useAwait: protocol requires async
    async (request) => {
      server.unsubscribe(request.params.uri);
      return {};
    }
  );

  // Prompt handlers
  sdkServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: server.getPrompts(),
  }));

  sdkServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await server.getPrompt(
      name,
      (args ?? {}) as Record<string, string | undefined>
    );

    if (result.isErr()) {
      throw toSdkError(result.error);
    }

    return { ...result.value };
  });

  // Completion handler
  sdkServer.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;
    const completionRef =
      ref.type === "ref/prompt"
        ? { type: "ref/prompt" as const, name: ref.name }
        : { type: "ref/resource" as const, uri: ref.uri };

    const result = await server.complete(
      completionRef,
      argument.name,
      argument.value
    );

    if (result.isErr()) {
      throw toSdkError(result.error);
    }

    return { completion: result.value };
  });

  // Logging handler
  sdkServer.setRequestHandler(
    SetLevelRequestSchema,
    // biome-ignore lint/suspicious/useAwait: protocol requires async
    async (request) => {
      const level = request.params.level as McpLogLevel;
      server.setLogLevel?.(level);
      return {};
    }
  );

  // Bind SDK server to allow notifications
  server.bindSdkServer?.(sdkServer);

  return sdkServer;
}

/**
 * Connect an MCP server over stdio transport.
 */
export async function connectStdio(
  server: McpServer,
  transport: StdioServerTransport = new StdioServerTransport()
): Promise<Server> {
  const sdkServer = createSdkServer(server);
  await sdkServer.connect(transport);
  return sdkServer;
}
