/**
 * Prompt and completion type definitions for MCP servers.
 *
 * @packageDocumentation
 */

import type { OutfitterError, Result } from "@outfitter/contracts";

import type { ContentAnnotations } from "./content-types.js";

// ============================================================================
// Completions
// ============================================================================

/**
 * Result of a completion request.
 */
export interface CompletionResult {
  /** Whether there are more values */
  hasMore?: boolean;
  /** Total number of available values (for pagination) */
  total?: number;
  /** Completion values */
  values: string[];
}

/**
 * Handler for generating completions.
 */
export type CompletionHandler = (value: string) => Promise<CompletionResult>;

/**
 * Reference to a prompt or resource for completion.
 */
export type CompletionRef =
  | { type: "ref/prompt"; name: string }
  | { type: "ref/resource"; uri: string };

// ============================================================================
// Prompt Arguments and Messages
// ============================================================================

/**
 * Argument definition for a prompt.
 */
export interface PromptArgument {
  /** Optional completion handler for this argument */
  complete?: CompletionHandler;
  /** Human-readable description */
  description?: string;
  /** Argument name */
  name: string;
  /** Whether this argument is required */
  required?: boolean;
}

/**
 * Content block within a prompt message.
 */
export interface PromptMessageContent {
  /** Optional content annotations */
  annotations?: ContentAnnotations;
  /** Text content */
  text: string;
  /** Content type */
  type: "text";
}

/**
 * A message in a prompt response.
 */
export interface PromptMessage {
  /** Message content */
  content: PromptMessageContent;
  /** Message role */
  role: "user" | "assistant";
}

/**
 * Result returned from getting a prompt.
 */
export interface PromptResult {
  /** Optional description override */
  description?: string;
  /** Prompt messages */
  messages: PromptMessage[];
}

/**
 * Handler for generating prompt messages.
 */
export type PromptHandler = (
  args: Record<string, string | undefined>
) => Promise<Result<PromptResult, OutfitterError>>;

// ============================================================================
// Prompt Definition
// ============================================================================

/**
 * Definition of an MCP prompt.
 *
 * Prompts are reusable templates that generate messages for LLMs.
 *
 * @example
 * ```typescript
 * const reviewPrompt: PromptDefinition = {
 *   name: "code-review",
 *   description: "Review code changes",
 *   arguments: [
 *     { name: "language", description: "Programming language", required: true },
 *   ],
 *   handler: async (args) => Result.ok({
 *     messages: [{ role: "user", content: { type: "text", text: `Review this ${args.language} code` } }],
 *   }),
 * };
 * ```
 */
export interface PromptDefinition {
  /** Prompt arguments */
  arguments: PromptArgument[];
  /** Human-readable description */
  description?: string;
  /** Handler to generate messages */
  handler: PromptHandler;
  /** Unique prompt name */
  name: string;
}
