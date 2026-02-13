import type { OutputMode } from "@outfitter/cli/types";

export type StructuredOutputMode = Extract<OutputMode, "json" | "jsonl">;

/**
 * Resolve machine-readable output mode from explicit options first, then env.
 */
export function resolveStructuredOutputMode(
  mode?: OutputMode
): StructuredOutputMode | undefined {
  if (mode !== undefined) {
    if (mode === "json" || mode === "jsonl") {
      return mode;
    }
    return undefined;
  }

  if (process.env["OUTFITTER_JSONL"] === "1") {
    return "jsonl";
  }

  if (process.env["OUTFITTER_JSON"] === "1") {
    return "json";
  }

  return undefined;
}
