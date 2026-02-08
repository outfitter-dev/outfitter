---
"@outfitter/cli": patch
---

Fix `output()` to default to human mode for non-TTY environments. Previously, non-TTY output (piped, subprocess) unexpectedly emitted JSON. Machine-readable output now requires explicit `--json` flag or `OUTFITTER_JSON=1` env var, per CLI conventions.
