import { Result } from "@outfitter/contracts";

import type { TargetId } from "../targets/index.js";

/** Subset of target IDs that are valid presets for `outfitter init`. */
export type InitPresetId = Extract<
  TargetId,
  "minimal" | "cli" | "mcp" | "daemon" | "library" | "full-stack"
>;

/**
 * Parses a comma-separated `--with` flag value into an array of block names.
 * @returns The parsed block names, or `undefined` if the flag is empty/absent.
 */
export function parseBlocks(
  withFlag: string | undefined
): readonly string[] | undefined {
  if (!withFlag) {
    return undefined;
  }

  const blocks = withFlag
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return blocks.length > 0 ? blocks : undefined;
}

/** Returns `true` if the preset produces a project with a binary entry point. */
export function isBinaryPreset(preset: InitPresetId): boolean {
  return preset === "cli" || preset === "daemon";
}

/** Type guard that narrows a string to {@link InitPresetId}. */
export function isValidInitPreset(value: string): value is InitPresetId {
  return (
    value === "minimal" ||
    value === "cli" ||
    value === "mcp" ||
    value === "daemon" ||
    value === "library" ||
    value === "full-stack"
  );
}

/**
 * Validates and resolves a `--preset` flag value against the available preset list.
 * @returns The validated preset ID, `undefined` if no flag was provided, or an error for unknown presets.
 */
export function resolvePresetFromFlags(
  presetFromFlag: string | undefined,
  availablePresetIds: readonly string[]
): Result<InitPresetId | undefined, string> {
  if (!presetFromFlag) {
    return Result.ok(undefined);
  }

  const knownAvailablePresetIds = availablePresetIds.filter(isValidInitPreset);
  const isKnownAndAvailable =
    isValidInitPreset(presetFromFlag) &&
    knownAvailablePresetIds.includes(presetFromFlag);

  if (!isKnownAndAvailable) {
    return Result.err(
      `Unknown preset '${presetFromFlag}'. Available presets: ${knownAvailablePresetIds.join(", ")}`
    );
  }

  return Result.ok(presetFromFlag);
}
