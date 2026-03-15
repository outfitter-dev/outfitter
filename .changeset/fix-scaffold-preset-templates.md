---
"@outfitter/presets": patch
---

Fix scaffold preset template issues found during v0.4.0 scaffold trial:
- library: use bracket notation for index signature access (TS4111)
- full-stack: update output() call to string format API
- mcp: add @outfitter/logging to dependencies, fix README param docs
- mcp: standardize Result narrowing guards in test template
- minimal: use ValidationError instead of plain Error
