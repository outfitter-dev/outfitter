---
"@outfitter/cli": patch
---

Fix `--json` flag bridging to `OUTFITTER_JSON` environment variable.

- **fix**: `createCLI()` now bridges `--json` (global or subcommand) into `OUTFITTER_JSON` via preAction/postAction hooks, eliminating manual `optsWithGlobals()` detection in commands (#340)
- **chore**: Convert cross-package deps to peerDependencies (#344)
