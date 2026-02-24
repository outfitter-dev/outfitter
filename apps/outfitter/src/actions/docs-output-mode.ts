/**
 * Shared output mode resolver for docs actions.
 *
 * @packageDocumentation
 */

import type { OutputMode } from "@outfitter/cli/types";

import type { CliOutputMode } from "../output-mode.js";

export function resolveDocsOutputMode(
  flags: Record<string, unknown>,
  presetOutputMode: OutputMode
): CliOutputMode {
  const explicitOutput = typeof flags["output"] === "string";
  if (explicitOutput) {
    return presetOutputMode === "json" || presetOutputMode === "jsonl"
      ? presetOutputMode
      : "human";
  }

  if (process.env["OUTFITTER_JSONL"] === "1") {
    return "jsonl";
  }

  if (process.env["OUTFITTER_JSON"] === "1") {
    return "json";
  }

  return "human";
}
