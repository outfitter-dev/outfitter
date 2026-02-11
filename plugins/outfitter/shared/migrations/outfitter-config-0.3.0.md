---
package: "@outfitter/config"
version: 0.3.0
breaking: false
---

# @outfitter/config → 0.3.0

## New APIs

### `getEnvironment()`

Reads `OUTFITTER_ENV` and returns one of:

- `"development"`
- `"production"`
- `"test"`

Invalid or unset values fall back to `"production"`.

```typescript
import { getEnvironment } from "@outfitter/config";

const env = getEnvironment();
```

### `getEnvironmentDefaults()`

Returns profile defaults shared across Outfitter packages.

```typescript
import { getEnvironmentDefaults } from "@outfitter/config";

const defaults = getEnvironmentDefaults("development");
// { logLevel: "debug", verbose: true, errorDetail: "full" }
```

Default profiles:

| Setting | `development` | `production` | `test` |
|---------|---------------|--------------|--------|
| `logLevel` | `"debug"` | `null` | `null` |
| `verbose` | `true` | `false` | `false` |
| `errorDetail` | `"full"` | `"message"` | `"full"` |

## Migration Steps

### Replace Ad-Hoc Environment Mapping

**Before:**

```typescript
const isDev = process.env["NODE_ENV"] !== "production";
const logLevel = isDev ? "debug" : "info";
```

**After:**

```typescript
import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";

const env = getEnvironment();
const defaults = getEnvironmentDefaults(env);
const logLevel = defaults.logLevel;
```

### Adopt `OUTFITTER_ENV` for Outfitter Runtime Defaults

Set one variable for cross-package defaults:

```bash
OUTFITTER_ENV=development
OUTFITTER_ENV=production
OUTFITTER_ENV=test
```

Use `OUTFITTER_LOG_LEVEL` / `OUTFITTER_VERBOSE` only when you need overrides.

## No Action Required

- Existing config loading APIs (`loadConfig`, `resolveConfig`) are unchanged
- XDG directory helpers are unchanged
- JSON / JSONC / TOML / YAML parsing behavior is unchanged
