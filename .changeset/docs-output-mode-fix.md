---
"outfitter": patch
---

Fix `resolveDocsOutputMode` to use `hasExplicitOutputFlag` pattern so that `OUTFITTER_JSON=1` and `OUTFITTER_JSONL=1` env vars work for docs commands when no explicit `--output` flag is passed. Commander default values no longer suppress env var fallback.
