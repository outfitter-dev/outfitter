---
package: "@outfitter/tui"
version: 0.2.0
breaking: false
---

# @outfitter/tui → 0.2.0

## New APIs

Initial package release for terminal UI rendering:

- Render primitives: tables, lists, boxes, trees, borders
- Streaming tools: spinners and in-place writers
- Themes and presets
- Result-wrapped prompts and `confirmDestructive()`

## Migration Steps

- Install `@outfitter/tui` and update imports previously sourced from `@outfitter/cli` render/streaming/theme/prompt subpaths.

## No Action Required

- Keep using raw `@outfitter/cli` output for machine-first workflows.
