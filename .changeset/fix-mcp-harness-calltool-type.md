---
"@outfitter/testing": minor
---

Add generic type parameter to `McpHarness.callTool<T>()` and fix default return type

The previous return type (`Result<McpToolResponse>`) was incorrect — `callTool` returns the raw handler output, not an MCP-wrapped `McpToolResponse`. The new signature defaults to `Result<unknown>` but accepts a type parameter so callers who know the handler shape can write `harness.callTool<MyOutput>("tool", input)` without unsafe casts.
