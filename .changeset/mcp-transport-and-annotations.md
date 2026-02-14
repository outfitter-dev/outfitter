---
"@outfitter/mcp": minor
---

Fix runtime resource/prompt registration, add annotation presets, and improve adaptHandler.

- **fix**: `createSdkServer` no longer registers unused resource/prompt capabilities (#331)
- **feat**: Export `wrapToolResult` and `wrapToolError` from transport subpath (#341)
- **feat**: Add `TOOL_ANNOTATIONS` presets (`readOnly`, `writeIdempotent`, `writeAppend`, `destructive`, `control`) (#342)
- **feat**: `adaptHandler` now accepts generic error type parameter (#342)
- **chore**: Convert cross-package deps to peerDependencies (#344)
