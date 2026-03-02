---
"@outfitter/contracts": minor
---

Add `parseInput(schema, data)` Zod-to-Result helper. Wraps `safeParse` into `Result<T, ValidationError>` where `T` is automatically inferred from the schema — no manual type argument needed.
