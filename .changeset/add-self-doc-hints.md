---
"@outfitter/cli": minor
---

Add self-documenting root command and hint generation tiers. When no subcommand is given, `createCLI()` outputs the full command tree as JSON (piped/JSON mode) or help text (TTY mode). The command tree includes all registered commands with descriptions and available options. Implement three hint generation tiers: Tier 1 (`commandTreeHints()`) auto-generates CLIHint[] from the Commander command registry. Tier 2 (`errorRecoveryHints()`) produces standard recovery actions per error category using enriched ErrorCategory metadata (retryable flags). Tier 3 (`schemaHintParams()`) populates hint params from Zod input schemas. All functions exported from `@outfitter/cli/hints` subpath.
