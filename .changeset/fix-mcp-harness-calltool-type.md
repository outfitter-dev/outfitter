---
"@outfitter/testing": minor
---

Fix `McpHarness.callTool` return type from `Result<McpToolResponse>` to `Result<unknown>`

The previous return type was incorrect — `callTool` returns the raw handler output, not an MCP-wrapped `McpToolResponse`. Callers accessing `.content` on the result would get a TypeScript pass but a runtime `undefined`. The new type accurately reflects runtime behavior and forces callers to narrow the type explicitly.
