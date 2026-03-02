/**
 * Shared output mode resolver for docs actions.
 *
 * @packageDocumentation
 */

import type { OutputMode } from "@outfitter/cli/types";

import type { CliOutputMode } from "../output-mode.js";
import { hasExplicitOutputFlag } from "./shared.js";

export function resolveDocsOutputMode(
  flags: Record<string, unknown>,
  presetOutputMode: OutputMode
): CliOutputMode {
  if (hasExplicitOutputFlag(flags)) {
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
