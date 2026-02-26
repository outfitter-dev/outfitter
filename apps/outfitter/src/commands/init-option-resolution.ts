import { Result } from "@outfitter/contracts";

import type { TargetId } from "../targets/index.js";

export type InitPresetId = Extract<
  TargetId,
  "minimal" | "cli" | "mcp" | "daemon" | "library" | "full-stack"
>;

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

export function isBinaryPreset(preset: InitPresetId): boolean {
  return preset === "cli" || preset === "daemon";
}

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

export function resolvePresetFromFlags(
  presetFromFlag: string | undefined,
  availablePresetIds: readonly string[]
): Result<InitPresetId | undefined, string> {
  if (!presetFromFlag) {
    return Result.ok(undefined);
  }

  if (!isValidInitPreset(presetFromFlag)) {
    return Result.err(
      `Unknown preset '${presetFromFlag}'. Available presets: ${availablePresetIds.join(", ")}`
    );
  }

  return Result.ok(presetFromFlag);
}
