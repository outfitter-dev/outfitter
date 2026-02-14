import type { OutputMode } from "@outfitter/cli/types";

export type StructuredOutputMode = Extract<OutputMode, "json" | "jsonl">;

/** Output modes resolvable from CLI flags and env vars. */
export type CliOutputMode = "human" | "json" | "jsonl";

/**
 * Resolve output mode from CLI context (flags + env vars).
 *
 * Precedence: explicit flag > OUTFITTER_JSONL env > OUTFITTER_JSON env > "human"
 *
 * This function is pure -- no env var side effects.
 */
export function resolveOutputModeFromContext(
  flags: Record<string, unknown>
): CliOutputMode {
  // Flag takes priority
  if (flags["json"]) return "json";
  if (flags["jsonl"]) return "jsonl";

  // Env var fallback (JSONL takes priority over JSON)
  if (process.env["OUTFITTER_JSONL"] === "1") return "jsonl";
  if (process.env["OUTFITTER_JSON"] === "1") return "json";

  return "human";
}

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
