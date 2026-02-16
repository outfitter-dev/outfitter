---
"@outfitter/schema": minor
"@outfitter/cli": minor
---

Add markdown reference doc generation from action manifests. `formatManifestMarkdown()` converts manifests to readable markdown with surface-aware rendering — MCP shows JSON Schema parameters and deferred loading annotations, CLI shows flag syntax, defaults, and aliases. CLI gains `schema docs` subcommand for writing `MCP_REFERENCE.md` or `CLI_REFERENCE.md` to disk.
