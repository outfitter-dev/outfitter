---
"@outfitter/cli": minor
---

Add schema-driven presets via `createSchemaPreset()` and refactor `.preset()` to accept both `FlagPreset` and `SchemaPreset`. Schema presets use Zod schema fragments for auto-deriving Commander flags (same as `.input()`), eliminating the need for manual option declarations. Preset schemas compose with `.input()` — merged flags include both command input fields and preset fields. Existing `FlagPreset`-based presets continue to work unchanged (backward compatible). Also exports `isSchemaPreset()` type guard and `AnyPreset` union type.
