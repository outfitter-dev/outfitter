/**
 * @outfitter/mcp - Core MCP Tools
 *
 * Core tools that are always available for MCP tool search:
 * - docs: documentation and examples
 * - config: read/write configuration
 * - query: search and discovery
 *
 * @packageDocumentation
 */

import type { HandlerContext, OutfitterError } from "@outfitter/contracts";
import { Result, ValidationError } from "@outfitter/contracts";
import { z } from "zod";
import type { ToolDefinition } from "./types.js";

// =============================================================================
// Docs Tool
// =============================================================================

export type DocsSection = "overview" | "tools" | "examples" | "schemas";

export interface DocsToolInput {
  section?: DocsSection | undefined;
}

export interface DocsToolEntry {
  examples?: Array<{
    input: Record<string, unknown>;
    description?: string;
  }>;
  name: string;
  summary?: string;
}

export interface DocsToolResponse {
  examples?: Array<{
    name?: string;
    description?: string;
    input?: Record<string, unknown>;
    output?: unknown;
  }>;
  overview?: string;
  schemas?: Record<string, unknown>;
  tools?: DocsToolEntry[];
}

export interface DocsToolOptions {
  /** Optional override for the docs tool description. */
  description?: string;
  /** Static docs payload (used when getDocs is not provided). */
  docs?: DocsToolResponse;
  /** Dynamic docs provider. */
  getDocs?: (
    section?: DocsSection
  ) => DocsToolResponse | Promise<DocsToolResponse>;
}

const DEFAULT_DOCS: DocsToolResponse = {
  overview: "No documentation configured yet.",
  tools: [],
  examples: [],
  schemas: {},
};

const docsSchema = z.object({
  section: z.enum(["overview", "tools", "examples", "schemas"]).optional(),
});

function pickDocsSection(
  payload: DocsToolResponse,
  section?: DocsSection
): DocsToolResponse {
  if (!section) {
    return payload;
  }

  return {
    [section]: payload[section],
  } as DocsToolResponse;
}

export function defineDocsTool(
  options: DocsToolOptions = {}
): ToolDefinition<DocsToolInput, DocsToolResponse> {
  return {
    name: "docs",
    description:
      options.description ??
      "Documentation, usage patterns, and examples for this MCP server.",
    deferLoading: false,
    inputSchema: docsSchema,
    handler: async (input) => {
      const payload = options.getDocs
        ? await options.getDocs(input.section)
        : (options.docs ?? DEFAULT_DOCS);

      return Result.ok(pickDocsSection(payload, input.section));
    },
  };
}

// =============================================================================
// Config Tool
// =============================================================================

export type ConfigAction = "get" | "set" | "list";

export interface ConfigToolInput {
  action: ConfigAction;
  key?: string | undefined;
  value?: unknown | undefined;
}

export interface ConfigToolResponse {
  action: ConfigAction;
  config?: Record<string, unknown>;
  found?: boolean;
  key?: string;
  value?: unknown;
}

export interface ConfigStore {
  get(
    key: string
  ):
    | { value: unknown; found: boolean }
    | Promise<{ value: unknown; found: boolean }>;
  list(): Record<string, unknown> | Promise<Record<string, unknown>>;
  set(key: string, value: unknown): void | Promise<void>;
}

export interface ConfigToolOptions {
  /** Optional override for the config tool description. */
  description?: string;
  /** Initial config values when using the default in-memory store. */
  initial?: Record<string, unknown>;
  /** Custom config store implementation. */
  store?: ConfigStore;
}

const configSchema = z.object({
  action: z.enum(["get", "set", "list"]),
  key: z.string().optional(),
  value: z.unknown().optional(),
});

function createInMemoryStore(
  initial: Record<string, unknown> = {}
): ConfigStore {
  const store = new Map<string, unknown>(Object.entries(initial));

  return {
    get(key) {
      return { value: store.get(key), found: store.has(key) };
    },
    set(key, value) {
      store.set(key, value);
    },
    list() {
      return Object.fromEntries(store.entries());
    },
  };
}

export function defineConfigTool(
  options: ConfigToolOptions = {}
): ToolDefinition<ConfigToolInput, ConfigToolResponse> {
  const store = options.store ?? createInMemoryStore(options.initial);

  return {
    name: "config",
    description:
      options.description ?? "Read or modify server configuration values.",
    deferLoading: false,
    inputSchema: configSchema,
    handler: async (input) => {
      switch (input.action) {
        case "list": {
          const config = await store.list();
          return Result.ok({ action: "list", config });
        }
        case "get": {
          if (!input.key) {
            return Result.err(
              new ValidationError({
                message: "Config key is required for action 'get'.",
                field: "key",
              })
            );
          }
          const { value, found } = await store.get(input.key);
          return Result.ok({ action: "get", key: input.key, value, found });
        }
        case "set": {
          if (!input.key) {
            return Result.err(
              new ValidationError({
                message: "Config key is required for action 'set'.",
                field: "key",
              })
            );
          }
          await store.set(input.key, input.value);
          return Result.ok({
            action: "set",
            key: input.key,
            value: input.value,
          });
        }
        default:
          return Result.err(
            new ValidationError({
              message: `Unknown action: ${input.action}`,
              field: "action",
            })
          );
      }
    },
  };
}

// =============================================================================
// Query Tool
// =============================================================================

export interface QueryToolInput {
  cursor?: string | undefined;
  filters?: Record<string, unknown> | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  query?: string | undefined;
}

export interface QueryToolResponse<T = unknown> {
  _meta?: Record<string, unknown>;
  nextCursor?: string;
  results: T[];
}

export interface QueryToolOptions<T = unknown> {
  /** Optional override for the query tool description. */
  description?: string;
  /** Custom query handler implementation. */
  handler?: (
    input: NormalizedQueryInput,
    ctx: HandlerContext
  ) => Promise<Result<QueryToolResponse<T>, OutfitterError>>;
}

const querySchema = z
  .object({
    q: z
      .string()
      .min(1)
      .describe("Search query. Supports natural language or filter syntax.")
      .optional(),
    query: z
      .string()
      .min(1)
      .describe("Alias for q. Supports natural language or filter syntax.")
      .optional(),
    limit: z.number().int().positive().optional(),
    cursor: z.string().optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) => {
      const queryValue = (value.q ?? value.query)?.trim();
      return typeof queryValue === "string" && queryValue.length > 0;
    },
    {
      message: "Query is required.",
      path: ["q"],
    }
  );

export function defineQueryTool<T = unknown>(
  options: QueryToolOptions<T> = {}
): ToolDefinition<QueryToolInput, QueryToolResponse<T>> {
  return {
    name: "query",
    description:
      options.description ??
      "Search and discover resources with filters and pagination.",
    deferLoading: false,
    inputSchema: querySchema,
    handler: (input, ctx) => {
      const normalized = {
        ...input,
        q: (input.q ?? input.query ?? "").trim(),
      };

      if (options.handler) {
        return options.handler(normalized, ctx);
      }

      return Promise.resolve(
        Result.ok({
          results: [],
          _meta: {
            note: "No query handler configured.",
          },
        })
      );
    },
  };
}

// =============================================================================
// Core Tools Bundle
// =============================================================================

export interface CoreToolsOptions {
  config?: ConfigToolOptions;
  docs?: DocsToolOptions;
  query?: QueryToolOptions;
}

export type NormalizedQueryInput = Required<Pick<QueryToolInput, "q">> &
  Omit<QueryToolInput, "q">;

export type CoreToolDefinition =
  | ToolDefinition<DocsToolInput, DocsToolResponse>
  | ToolDefinition<ConfigToolInput, ConfigToolResponse>
  | ToolDefinition<QueryToolInput, QueryToolResponse>;

export function createCoreTools(
  options: CoreToolsOptions = {}
): CoreToolDefinition[] {
  return [
    defineDocsTool(options.docs),
    defineConfigTool(options.config),
    defineQueryTool(options.query),
  ];
}
