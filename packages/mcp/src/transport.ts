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
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { safeStringify } from "@outfitter/contracts";
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

function wrapToolResult(value: unknown): McpToolResponse {
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

function wrapToolError(error: unknown): McpToolResponse {
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
 * Create an MCP SDK server from an Outfitter MCP server.
 */
export function createSdkServer(server: McpServer): Server {
  const sdkServer = new Server(
    { name: server.name, version: server.version },
    { capabilities: { tools: {} } }
  );

  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: server.getTools(),
  }));

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await server.invokeTool(
      name,
      (args ?? {}) as Record<string, unknown>
    );

    if (result.isErr()) {
      return wrapToolError(result.error);
    }

    return wrapToolResult(result.value);
  });

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
