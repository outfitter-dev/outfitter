---
"@outfitter/cli": minor
---

Add explicit `format` parameter to `output()` and `exitWithError()` for flag-driven format selection. The `mode` property has been removed from `OutputOptions`. Detection hierarchy (highest wins): (1) explicit `format` param, (2) env vars (`OUTFITTER_JSON`, `OUTFITTER_JSONL`), (3) default `"human"`. This is a breaking change to the function signatures.
