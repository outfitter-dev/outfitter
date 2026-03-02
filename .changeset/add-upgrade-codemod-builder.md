---
"outfitter": minor
---

Add `outfitter upgrade codemod` command that transforms Commander `.command().action()` patterns to the builder pattern with `.input(schema).action()`. Generates Zod schema skeletons from existing `.option()` / `.argument()` declarations. Commands too complex for automatic transformation (nested subcommands, dynamic patterns) are left as-is and reported as skipped with `cli.register()` fallback. Supports `--dry-run` for previewing changes and `--output json|jsonl` for structured output.
