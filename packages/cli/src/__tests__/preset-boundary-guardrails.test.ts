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
const REEXPORT_BLOCK_RE = /export\s+(?:type\s+)?\{([^}]+)\}/g;

const ALLOWED_PRESET_EXPORTS = new Set([
  // Types
  "AnyPreset",
  "ComposedPreset",
  "FlagPreset",
  "SchemaPreset",
  // Functions
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
    // Handles `as` aliases: export { foo as barPreset } -> tests "barPreset"
    let blockMatch: RegExpExecArray | null =
      REEXPORT_BLOCK_RE.exec(FLAGS_SOURCE);
    while (blockMatch) {
      const specifiers = blockMatch[1];
      if (specifiers) {
        for (const specifier of specifiers.split(",")) {
          const trimmed = specifier.trim();
          // For "Foo as Bar", the public name is "Bar"
          const parts = trimmed.split(/\s+as\s+/);
          const publicName = (parts.length > 1 ? parts[1] : parts[0]) ?? "";
          if (publicName && /(?:Preset|FlagPreset)\b/.test(publicName)) {
            exportedPresetNames.add(publicName);
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
