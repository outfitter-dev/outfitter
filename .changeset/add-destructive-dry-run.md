---
"@outfitter/cli": minor
---

Add `.destructive(isDest)` to `CommandBuilder` for marking commands as destructive. When `destructive(true)` is set, a `--dry-run` boolean flag is auto-added to the command (deduplicated if already present from `.option()` or `.preset()`). Add `dryRun` option to `runHandler()` — when `true`, the success envelope includes a CLIHint with the command to execute without `--dry-run` (preview-then-commit pattern). The handler is responsible for checking the dry-run flag and performing preview-only logic.
