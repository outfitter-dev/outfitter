---
"@outfitter/contracts": minor
---

Add transport-agnostic streaming types: `StreamEvent` discriminated union (`StreamStartEvent`, `StreamStepEvent`, `StreamProgressEvent`), `ProgressCallback` type, and optional `progress` field on `HandlerContext`. Handlers can call `ctx.progress?.()` to emit progress events without knowing which transport consumes them.
