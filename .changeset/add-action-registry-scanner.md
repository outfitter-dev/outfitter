---
"outfitter": minor
---

Add `outfitter check action-registry` command that cross-references command files in `apps/outfitter/src/commands/` against action definition imports in `apps/outfitter/src/actions/`. Reports unregistered command files with file paths. Supports `--output json|jsonl` for structured output. Exits with code 0 when all command files are referenced, code 1 when gaps are found.
