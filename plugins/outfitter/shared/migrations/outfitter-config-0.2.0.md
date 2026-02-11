---
package: "@outfitter/config"
version: 0.2.0
breaking: false
---

# @outfitter/config → 0.2.0

## New APIs

### JSONC Parsing

Config files with `.jsonc` or `.json5` extensions are now parsed with comment support via JSON5:

```typescript
import { loadConfig } from "@outfitter/config";

// config.jsonc is now a valid config file
const result = loadConfig("my-app", schema);
```

Supported config formats:
- `.json` — Strict JSON (no comments)
- `.jsonc` / `.json5` — JSON with comments and trailing commas
- `.toml` — TOML format
- `.yaml` / `.yml` — YAML with merge key support

### MCP Resource Handlers

Config loading now integrates with MCP resource handlers, allowing config values to be exposed as MCP resources.

## Migration Steps

### Use `.jsonc` for configs that need comments

**Before** (workaround with `.json`):
```json
{
  "debug": true
}
```

**After** (`.jsonc` with comments):
```jsonc
{
  // Enable debug mode for development
  "debug": true,

  // API endpoint — override in production
  "apiUrl": "http://localhost:3000",
}
```

## No Action Required

- Existing `.json`, `.toml`, `.yaml` configs work unchanged
- `loadConfig()` signature unchanged
- XDG directory resolution unchanged
- `extends` support unchanged
