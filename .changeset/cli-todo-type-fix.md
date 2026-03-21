---
"@outfitter/presets": patch
---

Fix cli-todo example type errors: use `NotFoundError.create()` instead of `Result.err(new Error(...))` and replace unsafe `as` cast with immutable spread pattern.
