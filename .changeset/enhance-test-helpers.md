---
"@outfitter/testing": minor
---

Enhanced testCommand() and testTool() with schema, context, and hints support for v0.5 builder pattern.

**testCommand() enhancements:**

- `input` option: Pre-parsed input object auto-converted to CLI args
- `context` option: Mock context injectable via `getTestContext()` for context factories
- `json` option: Force JSON output mode for envelope parsing
- `envelope` field: Parsed `CommandEnvelope` from JSON output for structured assertion
- Returns `TestCommandResult` (extends `CliTestResult` with `envelope`)

**testTool() enhancements:**

- `context` option: Full `HandlerContext` overrides (takes priority over individual cwd/env/requestId)
- `hints` option: Hint generation function for asserting on MCP hints
- Returns `TestToolResult` (extends `Result` with `hints`)

**New exports:**

- `getTestContext()`: Retrieve injected test context in context factories
- `TestCommandResult` type
- `TestToolResult` type

All changes are backward compatible — existing tests continue to work without modification.
