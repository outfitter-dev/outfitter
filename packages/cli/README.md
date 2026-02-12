# @outfitter/cli

Typed CLI runtime with output contracts, input parsing, and pagination for Bun.

## Installation

```bash
bun add @outfitter/cli
```

## Quick Start

```typescript
import { output } from "@outfitter/cli/output";
import { collectIds } from "@outfitter/cli/input";
import { loadCursor, saveCursor } from "@outfitter/cli/pagination";

// Output data with automatic mode detection
output({ id: "123", name: "Example" });

// Collect IDs from various input formats
const ids = await collectIds("id1,id2,id3");

// Handle pagination state
const cursor = loadCursor({ command: "list", toolName: "myapp" });
if (cursor) {
  // Continue from last position
}
```

## API Reference

### Output Utilities

#### `output(data, options?)`

Output data to the console with automatic mode selection.

Defaults to human-friendly output. Override via `mode` option or `OUTFITTER_JSON`/`OUTFITTER_JSONL` environment variables.

```typescript
import { output } from "@outfitter/cli/output";

// Basic usage - mode auto-detected
output(results);

// Force JSON mode
output(results, { mode: "json" });

// Pretty-print JSON
output(results, { mode: "json", pretty: true });

// Output to stderr
output(errors, { stream: process.stderr });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `OutputMode` | auto | Force a specific output mode |
| `stream` | `WritableStream` | `stdout` | Stream to write to |
| `pretty` | `boolean` | `false` | Pretty-print JSON output |

**Output Modes:**

- `human` - Human-readable key: value format
- `json` - Single JSON object
- `jsonl` - JSON Lines (one object per line)
- `tree` - Tree structure (reserved)
- `table` - Table format (reserved)

#### `exitWithError(error)`

Exit the process with an error message and appropriate exit code.

```typescript
import { exitWithError } from "@outfitter/cli/output";

try {
  await riskyOperation();
} catch (error) {
  exitWithError(error instanceof Error ? error : new Error(String(error)));
}
```

### Input Utilities

#### `collectIds(input, options?)`

Collect IDs from various input formats: space-separated, comma-separated, repeated flags, `@file`, and stdin.

```typescript
import { collectIds } from "@outfitter/cli/input";

// All these produce the same result:
// myapp show id1 id2 id3
// myapp show id1,id2,id3
// myapp show --ids id1 --ids id2
// myapp show @ids.txt
// echo "id1\nid2" | myapp show @-

const ids = await collectIds(args.ids, {
  allowFile: true,
  allowStdin: true,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowFile` | `boolean` | `true` | Allow `@file` expansion |
| `allowStdin` | `boolean` | `true` | Allow `@-` for stdin |

#### `expandFileArg(input, options?)`

Expand `@file` references to file contents. Returns input unchanged if not a file reference.

```typescript
import { expandFileArg } from "@outfitter/cli/input";

// myapp create @template.md
const content = await expandFileArg(args.content);

// With options
const content = await expandFileArg(args.content, {
  maxSize: 1024 * 1024, // 1MB limit
  trim: true,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | `BufferEncoding` | `utf-8` | File encoding |
| `maxSize` | `number` | - | Maximum file size in bytes |
| `trim` | `boolean` | `false` | Trim whitespace |

#### `parseGlob(pattern, options?)`

Parse and expand glob patterns using `Bun.Glob`.

```typescript
import { parseGlob } from "@outfitter/cli/input";

const files = await parseGlob("src/**/*.ts", {
  cwd: workspaceRoot,
  ignore: ["node_modules/**", "**/*.test.ts"],
  onlyFiles: true,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Working directory |
| `ignore` | `string[]` | `[]` | Patterns to exclude |
| `onlyFiles` | `boolean` | `false` | Only match files |
| `onlyDirectories` | `boolean` | `false` | Only match directories |
| `followSymlinks` | `boolean` | `false` | Follow symbolic links |

#### `parseKeyValue(input)`

Parse `key=value` pairs from CLI input.

```typescript
import { parseKeyValue } from "@outfitter/cli/input";

// --set key=value --set key2=value2
// --set key=value,key2=value2
const result = parseKeyValue(args.set);

if (result.isOk()) {
  // [{ key: "key", value: "value" }, { key: "key2", value: "value2" }]
  console.log(result.value);
}
```

#### `parseRange(input, type)`

Parse numeric or date range inputs.

```typescript
import { parseRange } from "@outfitter/cli/input";

// Numeric range
const numResult = parseRange("1-10", "number");
// => { type: "number", min: 1, max: 10 }

// Date range
const dateResult = parseRange("2024-01-01..2024-12-31", "date");
// => { type: "date", start: Date, end: Date }

// Single value
const single = parseRange("5", "number");
// => { type: "number", min: 5, max: 5 }
```

#### `parseFilter(input)`

Parse filter expressions from CLI input.

```typescript
import { parseFilter } from "@outfitter/cli/input";

const result = parseFilter("status:active,priority:>=high,!archived:true");

if (result.isOk()) {
  // [
  //   { field: "status", value: "active" },
  //   { field: "priority", value: "high", operator: "gte" },
  //   { field: "archived", value: "true", operator: "ne" }
  // ]
}
```

**Filter Operators:**

| Prefix | Operator | Description |
|--------|----------|-------------|
| (none) | `eq` | Equals (default) |
| `!` | `ne` | Not equals |
| `>` | `gt` | Greater than |
| `<` | `lt` | Less than |
| `>=` | `gte` | Greater than or equal |
| `<=` | `lte` | Less than or equal |
| `~` | `contains` | Contains substring |

#### `parseSortSpec(input)`

Parse sort specification from CLI input.

```typescript
import { parseSortSpec } from "@outfitter/cli/input";

const result = parseSortSpec("modified:desc,title:asc");

if (result.isOk()) {
  // [
  //   { field: "modified", direction: "desc" },
  //   { field: "title", direction: "asc" }
  // ]
}
```

#### `normalizeId(input, options?)`

Normalize an identifier with validation.

```typescript
import { normalizeId } from "@outfitter/cli/input";

const result = normalizeId("  MY-ID  ", {
  trim: true,
  lowercase: true,
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-z0-9-]+$/,
});

if (result.isOk()) {
  // "my-id"
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trim` | `boolean` | `false` | Trim whitespace |
| `lowercase` | `boolean` | `false` | Convert to lowercase |
| `minLength` | `number` | - | Minimum length |
| `maxLength` | `number` | - | Maximum length |
| `pattern` | `RegExp` | - | Required pattern |

#### `confirmDestructive(options)`

Prompt for confirmation before destructive operations. Respects `--yes` flag for non-interactive mode.

```typescript
import { confirmDestructive } from "@outfitter/cli/input";

const result = await confirmDestructive({
  message: "Delete 5 notes?",
  bypassFlag: flags.yes,
  itemCount: 5,
});

if (result.isErr()) {
  // User cancelled or non-TTY environment
  console.error("Operation cancelled");
  process.exit(0);
}

// Proceed with destructive operation
```

### Pagination Utilities

Pagination state persists per-command to support `--next` and `--reset` functionality.

**XDG State Directory Pattern:**

```
$XDG_STATE_HOME/{toolName}/cursors/{command}[/{context}]/cursor.json
```

#### `loadCursor(options)`

Load persisted pagination state for a command.

```typescript
import { loadCursor } from "@outfitter/cli/pagination";

const state = loadCursor({
  command: "list",
  toolName: "waymark",
  context: "workspace-123", // optional
  maxAgeMs: 30 * 60 * 1000, // optional expiration window
});

if (state) {
  // Continue from last position
  const results = await listNotes({ cursor: state.cursor });
}
```

#### `saveCursor(cursor, options)`

Save pagination state for a command.

```typescript
import { saveCursor } from "@outfitter/cli/pagination";

const results = await listNotes({ limit: 20 });

if (results.hasMore) {
  saveCursor(results.cursor, {
    command: "list",
    toolName: "waymark",
  });
}
```

#### `clearCursor(options)`

Clear persisted pagination state for a command.

```typescript
import { clearCursor } from "@outfitter/cli/pagination";

// User passed --reset flag
if (flags.reset) {
  clearCursor({
    command: "list",
    toolName: "waymark",
  });
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OUTFITTER_ENV` | Environment profile (`development`, `production`, `test`) | `production` |
| `OUTFITTER_VERBOSE` | Override verbose mode (`1` or `0`) | - |
| `OUTFITTER_JSON` | Set to `1` to force JSON output | - |
| `OUTFITTER_JSONL` | Set to `1` to force JSONL output (takes priority over JSON) | - |
| `XDG_STATE_HOME` | State directory for pagination | Platform-specific |

### `resolveVerbose(verbose?)`

Resolve verbose mode from environment configuration. Use this instead of hardcoding verbosity so your CLI responds to `OUTFITTER_ENV` and `OUTFITTER_VERBOSE` automatically.

**Precedence** (highest wins):
1. `OUTFITTER_VERBOSE` environment variable (`"1"` or `"0"`)
2. Explicit `verbose` parameter (from `--verbose` CLI flag)
3. `OUTFITTER_ENV` profile defaults (`true` in development)
4. `false` (default)

```typescript
import { resolveVerbose } from "@outfitter/cli/output";

const isVerbose = resolveVerbose();
// With OUTFITTER_ENV=development → true
// With OUTFITTER_VERBOSE=0 → false (overrides everything)
// With nothing set → false

// Pass through from CLI flag
const isVerbose = resolveVerbose(cliFlags.verbose);
```

### JSON Output

`createCLI()` registers a global `--json` flag that bridges to `OUTFITTER_JSON=1` via a `preAction` hook. This means `output()` auto-detects JSON mode — no manual `if (json)` branching needed:

```typescript
// No need for this:
if (opts.json) output(data, { mode: "json" });
else output(data);

// Just use output() directly — it reads OUTFITTER_JSON:
output(data);
```

The bridge uses `optsWithGlobals()` so global and subcommand `--json` flags both work and coalesce into a single env var. Subcommands should **not** define their own `--json` — use the global flag. If they do, both coalesce safely.

### Output Mode Priority

1. Explicit `mode` option in `output()` call
2. `OUTFITTER_JSONL=1` environment variable (highest env priority)
3. `OUTFITTER_JSON=1` environment variable
4. `OUTFITTER_JSON=0` or `OUTFITTER_JSONL=0` forces human mode
5. Default fallback: `human`

## Error Handling

### Exit Code Mapping

Exit codes are automatically determined from error categories:

| Category | Exit Code |
|----------|-----------|
| `validation` | 1 |
| `not_found` | 2 |
| `conflict` | 3 |
| `permission` | 4 |
| `timeout` | 5 |
| `rate_limit` | 6 |
| `network` | 7 |
| `internal` | 8 |
| `auth` | 9 |
| `cancelled` | 130 |

### Tagged Errors

Errors with a `category` property are automatically mapped to exit codes:

```typescript
const error = new Error("File not found") as Error & { category: string };
error.category = "not_found";

exitWithError(error); // Exits with code 2
```

## Types

All types are exported for TypeScript consumers:

```typescript
import type { CLIConfig, CommandConfig, CommandAction, CommandFlags } from "@outfitter/cli/command";
import type { OutputMode, OutputOptions } from "@outfitter/cli/output";
import type { CollectIdsOptions, ExpandFileOptions, ParseGlobOptions } from "@outfitter/cli/input";
import type { PaginationState, CursorOptions } from "@outfitter/cli/pagination";
```

## Upgrading

Run `outfitter update --guide` for version-specific migration instructions, or check the [migration docs](https://github.com/outfitter-dev/outfitter/tree/main/plugins/outfitter/shared/migrations) for detailed upgrade steps.

## License

MIT
