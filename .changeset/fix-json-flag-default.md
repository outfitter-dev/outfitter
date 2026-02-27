---
"@outfitter/cli": patch
---

Fix `--json` global flag default from `false` to `undefined` so downstream code can distinguish "not passed" from "explicitly disabled". The preAction env bridge now only sets `OUTFITTER_JSON` when `--json` is explicitly passed.
