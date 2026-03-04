/**
 * Resource-related type definitions for MCP servers.
 *
 * @packageDocumentation
 */

import type {
  HandlerContext,
  OutfitterError,
  Result,
} from "@outfitter/contracts";
import type { z } from "zod";

import type { CompletionHandler } from "./prompt-types.js";

// ============================================================================
// Content Annotations
// ============================================================================

/**
 * Annotations for content items (resource content, prompt messages).
 *
 * Provides hints about content audience and priority.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/annotations/
 */
export interface ContentAnnotations {
  /**
   * Who the content is intended for.
   * Can include "user", "assistant", or both.
   */
  audience?: Array<"user" | "assistant">;

  /**
   * Priority level from 0.0 (least) to 1.0 (most important).
   */
  priority?: number;
}

// ============================================================================
// Resource Content
// ============================================================================

/**
 * Text content returned from a resource read.
 */
export interface TextResourceContent {
  /** Optional content annotations */
  annotations?: ContentAnnotations;
  /** Optional MIME type */
  mimeType?: string;
  /** Text content */
  text: string;
  /** Resource URI */
  uri: string;
}

/**
 * Binary (base64-encoded) content returned from a resource read.
 */
export interface BlobResourceContent {
  /** Optional content annotations */
  annotations?: ContentAnnotations;
  /** Base64-encoded binary content */
  blob: string;
  /** Optional MIME type */
  mimeType?: string;
  /** Resource URI */
  uri: string;
}

/**
 * Content returned from reading a resource.
 */
export type ResourceContent = TextResourceContent | BlobResourceContent;

// ============================================================================
// Resource Definition
// ============================================================================

/**
 * Handler for reading a resource's content.
 *
 * @param uri - The resource URI being read
 * @param ctx - Handler context with logger and requestId
 * @returns Array of resource content items
 */
export type ResourceReadHandler = (
  uri: string,
  ctx: HandlerContext
) => Promise<Result<ResourceContent[], OutfitterError>>;

/**
 * Definition of an MCP resource that can be read by clients.
 *
 * Resources represent data that clients can access, such as files,
 * database records, or API responses.
 *
 * @example
 * ```typescript
 * const configResource: ResourceDefinition = {
 *   uri: "file:///etc/app/config.json",
 *   name: "Application Config",
 *   description: "Main application configuration file",
 *   mimeType: "application/json",
 *   handler: async (uri, ctx) => {
 *     const content = await readFile(uri);
 *     return Result.ok([{ uri, text: content }]);
 *   },
 * };
 * ```
 */
export interface ResourceDefinition {
  /**
   * Optional description of the resource.
   * Provides additional context about the resource contents.
   */
  description?: string;

  /**
   * Optional handler for reading the resource content.
   * If not provided, the resource is metadata-only.
   */
  handler?: ResourceReadHandler;

  /**
   * Optional MIME type of the resource content.
   * Helps clients understand how to process the resource.
   */
  mimeType?: string;

  /**
   * Human-readable resource name.
   * Displayed to users in resource listings.
   */
  name: string;
  /**
   * Unique resource URI.
   * Must be a valid URI (file://, https://, custom://, etc.).
   */
  uri: string;
}

// ============================================================================
// Resource Templates
// ============================================================================

/**
 * Handler for reading a resource template's content.
 *
 * @param uri - The matched URI
 * @param variables - Extracted template variables
 * @param ctx - Handler context
 */
export type ResourceTemplateReadHandler = (
  uri: string,
  variables: Record<string, string>,
  ctx: HandlerContext
) => Promise<Result<ResourceContent[], OutfitterError>>;

/**
 * Definition of an MCP resource template with URI pattern matching.
 *
 * Templates use RFC 6570 Level 1 URI templates (e.g., `{param}`)
 * to match and extract variables from URIs.
 *
 * @example
 * ```typescript
 * const userTemplate: ResourceTemplateDefinition = {
 *   uriTemplate: "db:///users/{userId}/profile",
 *   name: "User Profile",
 *   handler: async (uri, variables) => {
 *     const profile = await getProfile(variables.userId);
 *     return Result.ok([{ uri, text: JSON.stringify(profile) }]);
 *   },
 * };
 * ```
 */
export interface ResourceTemplateDefinition {
  /** Optional completion handlers keyed by parameter name. */
  complete?: Record<string, CompletionHandler>;

  /** Optional description. */
  description?: string;

  /** Handler for reading matched resources. */
  handler: ResourceTemplateReadHandler;

  /** Optional MIME type. */
  mimeType?: string;

  /** Human-readable name for the template. */
  name: string;
  /** URI template with `{param}` placeholders (RFC 6570 Level 1). */
  uriTemplate: string;
}

// ============================================================================
// Typed Resource Template Definition
// ============================================================================

/**
 * Handler for reading a typed resource template's content.
 *
 * @param uri - The matched URI
 * @param params - Validated and parsed template parameters (typed via Zod schema)
 * @param ctx - Handler context
 */
export type TypedResourceTemplateReadHandler<TParams> = (
  uri: string,
  params: TParams,
  ctx: HandlerContext
) => Promise<Result<ResourceContent[], OutfitterError>>;

/**
 * Typed definition of an MCP resource template with Zod schema validation.
 *
 * Parallel to `ToolDefinition` — the `paramSchema` validates URI template
 * variables before handler invocation, providing type-safe parameters
 * and automatic coercion (e.g., string → number via `z.coerce.number()`).
 *
 * @typeParam TParams - The validated parameter type (inferred from Zod schema)
 *
 * @example
 * ```typescript
 * const userTemplate = defineResourceTemplate({
 *   uriTemplate: "db:///users/{userId}/posts/{postId}",
 *   name: "User Post",
 *   paramSchema: z.object({
 *     userId: z.string().min(1),
 *     postId: z.coerce.number().int().positive(),
 *   }),
 *   handler: async (uri, params, ctx) => {
 *     // params is { userId: string; postId: number } — validated and coerced
 *     const post = await getPost(params.userId, params.postId);
 *     return Result.ok([{ uri, text: JSON.stringify(post) }]);
 *   },
 * });
 * ```
 */
export interface TypedResourceTemplateDefinition<TParams> {
  /** Optional completion handlers keyed by parameter name. */
  complete?: Record<string, CompletionHandler>;

  /** Optional description. */
  description?: string;

  /**
   * Handler for reading matched resources.
   * Receives validated and coerced parameters (typed via `paramSchema`).
   */
  handler: TypedResourceTemplateReadHandler<TParams>;

  /** Optional MIME type. */
  mimeType?: string;

  /** Human-readable name for the template. */
  name: string;

  /**
   * Zod schema for validating and parsing URI template parameters.
   * Variables extracted from the URI template are validated against this schema
   * before being passed to the handler. Supports coercion (e.g., `z.coerce.number()`).
   */
  paramSchema: z.ZodType<TParams>;

  /** URI template with `{param}` placeholders (RFC 6570 Level 1). */
  uriTemplate: string;
}
