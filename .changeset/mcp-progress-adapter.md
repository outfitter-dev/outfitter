---
"@outfitter/mcp": minor
---

Add MCP progress adapter translating ctx.progress StreamEvent to notifications/progress.

When an MCP client provides a progressToken in tool call params, ctx.progress is now a
ProgressCallback (from @outfitter/contracts) that emits `notifications/progress` via the
MCP SDK for each StreamEvent. Without a progressToken, ctx.progress remains undefined.

The adapter is a separate module (`progress.ts`) for modularity, parallel to the CLI
NDJSON adapter in @outfitter/cli.
