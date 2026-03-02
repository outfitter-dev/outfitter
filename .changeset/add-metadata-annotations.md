---
"@outfitter/cli": minor
"@outfitter/mcp": minor
"@outfitter/contracts": minor
---

Add `.readOnly(bool)` and `.idempotent(bool)` methods to `CommandBuilder` for declaring safety metadata on commands. When set to `true`, these signals are included in the self-documenting root command tree (JSON mode) under a `metadata` field. In the MCP package, `buildMcpTools()` maps `readOnly` to `readOnlyHint` and `idempotent` to `idempotentHint` in MCP tool annotations via the `ActionMcpSpec` interface. Default is non-read-only, non-idempotent (metadata omitted when not set).
