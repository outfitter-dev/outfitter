import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FLAGS_SOURCE = readFileSync(
  join(import.meta.dir, "..", "flags.ts"),
  "utf8"
);

// Match both direct exports (export function fooPreset) and re-exports
// (export { fooPreset, barPreset }) to support internal module splits.
const DIRECT_EXPORT_RE =
  /export (?:function|const|let|var) (\w+(?:Preset|FlagPreset))\b/g;
const REEXPORT_BLOCK_RE = /export\s*\{([^}]+)\}/g;

const ALLOWED_PRESET_EXPORTS = new Set([
  "createPreset",
  "createSchemaPreset",
  "isSchemaPreset",
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

    // Match direct export declarations: export function fooPreset
    let match: RegExpExecArray | null = DIRECT_EXPORT_RE.exec(FLAGS_SOURCE);
    while (match) {
      const name = match[1];
      if (name) {
        exportedPresetNames.add(name);
      }
      match = DIRECT_EXPORT_RE.exec(FLAGS_SOURCE);
    }

    // Match re-export blocks: export { fooPreset, barPreset }
    let blockMatch: RegExpExecArray | null =
      REEXPORT_BLOCK_RE.exec(FLAGS_SOURCE);
    while (blockMatch) {
      const specifiers = blockMatch[1];
      if (specifiers) {
        for (const specifier of specifiers.split(",")) {
          const name = specifier.trim();
          if (name && /(?:Preset|FlagPreset)\b/.test(name)) {
            exportedPresetNames.add(name);
          }
        }
      }
      blockMatch = REEXPORT_BLOCK_RE.exec(FLAGS_SOURCE);
    }

    expect([...exportedPresetNames].toSorted()).toEqual(
      [...ALLOWED_PRESET_EXPORTS].toSorted()
    );
  });
});
