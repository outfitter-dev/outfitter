import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FLAGS_SOURCE = readFileSync(
  join(import.meta.dir, "..", "flags.ts"),
  "utf8"
);
const PRESET_EXPORT_RE =
  /export (?:function|const|let|var) (\w+(?:Preset|FlagPreset))\b/g;

const ALLOWED_PRESET_EXPORTS = new Set([
  "createPreset",
  "booleanFlagPreset",
  "enumFlagPreset",
  "numberFlagPreset",
  "stringListFlagPreset",
  "verbosePreset",
  "cwdPreset",
  "dryRunPreset",
  "forcePreset",
  "interactionPreset",
  "strictPreset",
  "colorPreset",
  "projectionPreset",
  "timeWindowPreset",
  "executionPreset",
  "paginationPreset",
]);

describe("preset boundary guardrails", () => {
  test("keeps @outfitter/cli preset exports limited to shared/generic conventions", () => {
    const exportedPresetNames = new Set<string>();
    let match: RegExpExecArray | null = PRESET_EXPORT_RE.exec(FLAGS_SOURCE);

    while (match) {
      const name = match[1];
      if (name) {
        exportedPresetNames.add(name);
      }
      match = PRESET_EXPORT_RE.exec(FLAGS_SOURCE);
    }

    expect([...exportedPresetNames].toSorted()).toEqual(
      [...ALLOWED_PRESET_EXPORTS].toSorted()
    );
  });
});
