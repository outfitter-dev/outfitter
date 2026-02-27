---
"@outfitter/cli": patch
---

Fix `validateInput()` to surface Zod validation errors via `exitWithError()` instead of silently falling through to raw input. When `.input(schema)` is used and schema validation fails, the command now exits with code 1 (validation category) and outputs a `ValidationError` with Zod issue details (field names, expected types, messages). Invalid data no longer reaches `.action()` handlers.
