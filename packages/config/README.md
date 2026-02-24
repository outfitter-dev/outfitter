# @outfitter/config

XDG-compliant configuration loading with schema validation for Outfitter applications.

## Features

- **XDG Base Directory Specification** - Proper paths for config, data, cache, and state
- **Multi-format support** - TOML, YAML, JSON, and JSON5
- **Schema validation** - Zod-powered type-safe configuration
- **Multi-source merging** - Combine defaults, files, env vars, and CLI flags
- **Deep merge** - Intelligent merging of nested configuration objects

## Installation

```bash
bun add @outfitter/config
```

## Quick Start

```typescript
import { loadConfig, resolveConfig, getConfigDir } from "@outfitter/config";
import { z } from "zod";

// Define your configuration schema
const AppConfigSchema = z.object({
  apiKey: z.string(),
  timeout: z.number().default(5000),
  features: z.object({
    darkMode: z.boolean().default(false),
  }),
});

// Load from XDG paths (~/.config/myapp/config.toml)
const result = await loadConfig("myapp", AppConfigSchema);

if (result.isOk()) {
  console.log("Config loaded:", result.value);
} else {
  console.error("Failed:", result.error.message);
}
```

## API Reference

### Configuration Loading

#### `loadConfig(appName, schema, options?)`

Load configuration from XDG-compliant paths with schema validation.

```typescript
const result = await loadConfig("myapp", AppConfigSchema);

if (result.isOk()) {
  const config = result.value;
  // Type-safe access to your config
}
```

**Parameters:**

- `appName` - Application name for XDG directory lookup
- `schema` - Zod schema for validation
- `options.searchPaths` - Custom search paths (overrides XDG defaults)

**Search Order:**

1. Custom `searchPaths` if provided
2. `$XDG_CONFIG_HOME/{appName}/config.{ext}`
3. `~/.config/{appName}/config.{ext}`

**File Format Preference:** `.toml` > `.yaml` > `.yml` > `.json` > `.jsonc` > `.json5`

**Returns:** `Result<T, NotFoundError | ValidationError | ParseError>`

---

#### `resolveConfig(schema, sources)`

Merge configuration from multiple sources with precedence rules.

```typescript
const result = resolveConfig(AppSchema, {
  defaults: { port: 3000, host: "localhost" },
  file: loadedConfig,
  env: { port: parseInt(process.env.PORT!) },
  flags: cliArgs,
});
```

**Parameters:**

- `schema` - Zod schema for validation
- `sources` - Configuration sources to merge

**Returns:** `Result<T, ValidationError | ParseError>`

---

#### `parseConfigFile(content, filename)`

Parse configuration file content based on extension.

```typescript
const toml = `
[server]
port = 3000
host = "localhost"
`;

const result = parseConfigFile(toml, "config.toml");
if (result.isOk()) {
  console.log(result.value.server.port); // 3000
}
```

**Parameters:**

- `content` - Raw file content
- `filename` - Filename (extension determines parser)

**Returns:** `Result<Record<string, unknown>, ParseError>`

---

### XDG Path Helpers

#### `getConfigDir(appName)`

Get the XDG config directory for an application.

```typescript
getConfigDir("myapp");
// With XDG_CONFIG_HOME="/custom": "/custom/myapp"
// Default: "~/.config/myapp"
```

#### `getDataDir(appName)`

Get the XDG data directory for an application.

```typescript
getDataDir("myapp");
// With XDG_DATA_HOME="/custom": "/custom/myapp"
// Default: "~/.local/share/myapp"
```

#### `getCacheDir(appName)`

Get the XDG cache directory for an application.

```typescript
getCacheDir("myapp");
// With XDG_CACHE_HOME="/custom": "/custom/myapp"
// Default: "~/.cache/myapp"
```

#### `getStateDir(appName)`

Get the XDG state directory for an application.

```typescript
getStateDir("myapp");
// With XDG_STATE_HOME="/custom": "/custom/myapp"
// Default: "~/.local/state/myapp"
```

---

### Utilities

#### `deepMerge(target, source)`

Deep merge two objects with configurable semantics.

```typescript
const defaults = { server: { port: 3000, host: "localhost" } };
const overrides = { server: { port: 8080 } };

const merged = deepMerge(defaults, overrides);
// { server: { port: 8080, host: "localhost" } }
```

**Merge Behavior:**

- Recursively merges nested plain objects
- Arrays are replaced (not concatenated)
- `null` explicitly replaces the target value
- `undefined` is skipped (does not override)

---

### Types

#### `ConfigSources<T>`

Configuration sources for multi-layer resolution.

```typescript
interface ConfigSources<T> {
  defaults?: Partial<T>; // Lowest precedence
  file?: Partial<T>; // From config file
  env?: Partial<T>; // Environment variables
  flags?: Partial<T>; // CLI flags (highest)
}
```

#### `LoadConfigOptions`

Options for `loadConfig()`.

```typescript
interface LoadConfigOptions {
  searchPaths?: string[]; // Custom search paths
}
```

#### `ParseError`

Error thrown when configuration file parsing fails.

```typescript
class ParseError {
  readonly _tag = "ParseError";
  readonly message: string;
  readonly filename: string;
  readonly line?: number;
  readonly column?: number;
}
```

---

## Environment Profiles

Unified environment detection for consistent defaults across all Outfitter packages.

### `getEnvironment()`

Reads `OUTFITTER_ENV` and returns the current profile. Falls back to `"production"` when unset or invalid.

```typescript
import { getEnvironment } from "@outfitter/config";

const env = getEnvironment();
// "development" | "production" | "test"
```

### `getEnvironmentDefaults(env)`

Returns profile-specific defaults for an environment.

```typescript
import { getEnvironmentDefaults } from "@outfitter/config";

const defaults = getEnvironmentDefaults("development");
// { logLevel: "debug", verbose: true, errorDetail: "full" }

const prodDefaults = getEnvironmentDefaults("production");
// { logLevel: null, verbose: false, errorDetail: "message" }
```

| Setting     | `development` | `production` | `test`   |
| ----------- | ------------- | ------------ | -------- |
| logLevel    | `"debug"`     | `null`       | `null`   |
| verbose     | `true`        | `false`      | `false`  |
| errorDetail | `"full"`      | `"message"`  | `"full"` |

### Types

#### `OutfitterEnv`

```typescript
type OutfitterEnv = "development" | "production" | "test";
```

#### `EnvironmentDefaults`

```typescript
interface EnvironmentDefaults {
  logLevel: "debug" | "info" | "warn" | "error" | null;
  verbose: boolean;
  errorDetail: "full" | "message";
}
```

---

## XDG Base Directory Specification

This package follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) for locating configuration files.

| Variable          | macOS/Linux Default | Purpose                          |
| ----------------- | ------------------- | -------------------------------- |
| `XDG_CONFIG_HOME` | `~/.config`         | User-specific configuration      |
| `XDG_DATA_HOME`   | `~/.local/share`    | User-specific data files         |
| `XDG_CACHE_HOME`  | `~/.cache`          | Non-essential cached data        |
| `XDG_STATE_HOME`  | `~/.local/state`    | Persistent state (logs, history) |

---

## Override Precedence

Configuration sources are merged with the following precedence (highest to lowest):

```
+---------------------------------------+
|  flags (CLI arguments)      HIGHEST   |
+---------------------------------------+
|  env (environment variables)          |
+---------------------------------------+
|  file (config file)                   |
+---------------------------------------+
|  defaults                   LOWEST    |
+---------------------------------------+
```

Higher precedence sources override lower ones. Nested objects are deep-merged.

---

## Supported File Formats

| Extension       | Parser     | Notes                                  |
| --------------- | ---------- | -------------------------------------- |
| `.toml`         | smol-toml  | Preferred for configuration            |
| `.yaml`, `.yml` | yaml       | YAML anchors/aliases supported         |
| `.json`         | JSON.parse | Strict parsing                         |
| `.jsonc`        | json5      | JSON with comments and trailing commas |
| `.json5`        | json5      | Comments and trailing commas allowed   |

---

## Examples

### Loading with Custom Paths

```typescript
const result = await loadConfig("myapp", AppConfigSchema, {
  searchPaths: ["/etc/myapp", "/opt/myapp/config"],
});
```

### Multi-Source Configuration

```typescript
import { loadConfig, resolveConfig } from "@outfitter/config";

// Load base config from file
const fileResult = await loadConfig("myapp", RawConfigSchema);
const fileConfig = fileResult.isOk() ? fileResult.value : {};

// Resolve with all sources
const result = resolveConfig(AppConfigSchema, {
  defaults: {
    server: { port: 3000, host: "localhost" },
    logging: { level: "info" },
  },
  file: fileConfig,
  env: {
    server: { port: parseInt(process.env.PORT || "3000") },
    logging: { level: process.env.LOG_LEVEL },
  },
  flags: {
    logging: { level: cliArgs.verbose ? "debug" : undefined },
  },
});
```

### Error Handling

```typescript
const result = await loadConfig("myapp", AppConfigSchema);

if (result.isErr()) {
  switch (result.error._tag) {
    case "NotFoundError":
      console.log("Config file not found, using defaults");
      break;
    case "ValidationError":
      console.error("Invalid config:", result.error.message);
      break;
    case "ParseError":
      console.error("Parse error in", result.error.filename);
      break;
  }
}
```

---

## License

MIT
