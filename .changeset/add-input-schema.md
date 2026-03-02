---
"@outfitter/cli": minor
---

Add `.input(schema)` method to `CommandBuilder` for Zod-to-Commander auto-derive. Accepts a Zod object schema and auto-derives Commander flags: `z.string()` → string option, `z.number()` → number option with coercion, `z.boolean()` → boolean flag, `z.enum()` → choices option. `.describe()` text becomes option descriptions, `.default()` values become option defaults. Explicit `.option()`/`.requiredOption()` calls compose alongside `.input()` — they override or supplement auto-derived flags. The `.action()` handler receives a validated, typed `input` object when `.input()` is used.
