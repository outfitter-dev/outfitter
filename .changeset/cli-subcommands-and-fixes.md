---
"@outfitter/cli": minor
"@outfitter/presets": patch
"outfitter": patch
---

Add `.subcommand()`, `commandGroup()`, auto-derive Zod flags, and `onResult` callback

- `@outfitter/cli`: Add `.subcommand()` method to CommandBuilder for fluent nested commands
- `@outfitter/cli`: Add `commandGroup()` factory for declarative parent-with-children pattern
- `@outfitter/cli`: `buildCliCommands` auto-derives CLI flags from Zod input schemas
- `@outfitter/cli`: `buildCliCommands` gains `onResult` callback for handler output
- `@outfitter/presets`: Fix cli-todo example type errors
- `outfitter`: Add `--skip-existing` flag to `init` for graceful handling of existing files
