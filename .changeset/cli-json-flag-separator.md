---
"@outfitter/cli": patch
---

Fix `normalizeGlobalJsonFlag()` to respect `--` end-of-options separator. Previously, `--json` tokens after `--` were incorrectly relocated as global flags.
