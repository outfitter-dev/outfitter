---
"@outfitter/presets": patch
---

Fix CLI adapter patterns in scaffold presets: full-stack preset replaces `throw result.error` with `runHandler()`, daemon preset replaces raw `logger.error()` + `process.exit(1)` with `runHandler()` using typed error results (`ConflictError`, `NotFoundError`, `NetworkError`). Daemon CLAUDE.md updated to accurately describe the adapter pattern.
