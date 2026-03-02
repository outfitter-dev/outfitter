/**
 * Output mode type helpers.
 *
 * All resolution logic is centralized in `resolveOutputMode()` from
 * `@outfitter/cli/query`. This module provides type aliases and a
 * simple narrowing helper for structured modes.
 *
 * @packageDocumentation
 */

import type { OutputMode } from "@outfitter/cli/types";

export type StructuredOutputMode = Extract<OutputMode, "json" | "jsonl">;

/** Output modes resolvable from CLI flags and env vars. */
export type CliOutputMode = "human" | "json" | "jsonl";

/**
 * Narrow an output mode to its structured subset (`"json"` | `"jsonl"`).
 *
 * Returns `undefined` when the mode is not machine-readable (e.g., `"human"`,
 * `"tree"`, `"table"`) or when `mode` is `undefined`.
 * This is a pure type-narrowing helper — it does NOT check env vars.
 * Use `resolveOutputMode()` from `@outfitter/cli/query` for full resolution.
 */
export function resolveStructuredOutputMode(
  mode?: OutputMode
): StructuredOutputMode | undefined {
  return mode === "json" || mode === "jsonl" ? mode : undefined;
}
