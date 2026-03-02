---
"@outfitter/contracts": minor
---

Add `wrapError(error, mapper?)` for normalizing unknown errors into typed OutfitterErrors. Typed errors pass through unchanged (same reference, mapper not called). Untyped errors go through optional mapper; unmatched errors wrap as InternalError. Also adds `composeMappers()` for composable mapper pipelines that short-circuit on first match, and `isOutfitterError()` type guard.
