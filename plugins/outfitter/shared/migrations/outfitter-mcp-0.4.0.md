---
package: "@outfitter/mcp"
version: 0.4.0
breaking: false
---

# @outfitter/mcp → 0.4.0

## New APIs

- `TOOL_ANNOTATIONS` presets for common tool behavior metadata.
- Transport exports include `wrapToolResult` and `wrapToolError`.
- `adaptHandler` supports generic error typing.

## Migration Steps

- Adopt `TOOL_ANNOTATIONS` presets to consistently mark read-only/idempotent/destructive tools.
- Prefer `wrapToolResult` / `wrapToolError` in adapter code for normalized tool envelopes.

## No Action Required

- Existing `defineTool()` and server setup APIs remain compatible.
