# CLI Patterns

Deep dive into @outfitter/cli patterns for building AI-agent-ready CLI tools with typed commands, output contracts, and rendering primitives.

## Module Structure

The root export is minimal — colors and output only. Use subpath imports for everything else:

```typescript
// Root: colors + output
import { ANSI, createTheme, output } from "@outfitter/cli";
import type { OutputMode, Theme, Tokens } from "@outfitter/cli";

// CLI building
import { createCLI, command } from "@outfitter/cli/command";
import { buildCliCommands } from "@outfitter/cli/actions";
import { readStdin, collectIds, isPiped } from "@outfitter/cli/input";
import { loadCursor, saveCursor, clearCursor } from "@outfitter/cli/pagination";

// Rendering
import { renderTable, renderList, renderBox, renderTree } from "@outfitter/cli/render";
import { formatDuration, formatBytes, pluralize, slugify } from "@outfitter/cli/render";
import { parseDateRange, formatRelative } from "@outfitter/cli/render";

// Streaming (in-place terminal updates)
import { createSpinner, createStreamWriter } from "@outfitter/cli/streaming";

// Theming
import { createTheme, createTokens } from "@outfitter/cli/theme";
import { defaultTheme } from "@outfitter/cli/theme/presets/default";

// Prompts
import { text, confirm, select } from "@outfitter/cli/prompt";

// Presets (bundle common imports)
import { renderTable, renderList, renderBox } from "@outfitter/cli/preset/standard";
import { renderTree } from "@outfitter/cli/preset/full"; // standard + tree
```

### Subpath Summary

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/cli` | `ANSI`, `createTheme`, `output`, `OutputMode` |
| `@outfitter/cli/command` | `createCLI`, `command` builder |
| `@outfitter/cli/actions` | `buildCliCommands` (action registry → Commander) |
| `@outfitter/cli/output` | `output`, `exitWithError`, `resolveVerbose` |
| `@outfitter/cli/input` | `readStdin`, `collectIds`, `isPiped`, `expandFileArg` |
| `@outfitter/cli/pagination` | `loadCursor`, `saveCursor`, `clearCursor` |
| `@outfitter/cli/render` | Tables, lists, boxes, trees, formatting, text utilities |
| `@outfitter/cli/streaming` | `createSpinner`, `createStreamWriter`, ANSI sequences |
| `@outfitter/cli/theme` | `createTheme`, `createTokens`, theme context |
| `@outfitter/cli/theme/presets` | `default`, `rounded`, `bold`, `minimal` |
| `@outfitter/cli/prompt` | `text`, `confirm`, `select`, `group` |
| `@outfitter/cli/preset/standard` | Table + list + box rendering |
| `@outfitter/cli/preset/full` | Standard + tree rendering |
| `@outfitter/cli/terminal` | Terminal detection utilities |

## Creating a CLI

```typescript
import { createCLI, command } from "@outfitter/cli/command";
import { output } from "@outfitter/cli";

const cli = createCLI({
  name: "myapp",
  version: "1.0.0",
  description: "My CLI application",
});

cli.register(
  command("list")
    .description("List items")
    .action(async ({ flags }) => {
      const items = await listItems();
      await output(items, { mode: flags.json ? "json" : undefined });
    })
);

await cli.parse();
```

### Global `--json` Flag

`createCLI()` automatically adds a `--json` flag to all commands. Access it via `flags.json` in your action handler:

```typescript
.action(async ({ flags }) => {
  // flags.json is boolean (false by default)
  await output(data, { mode: flags.json ? "json" : undefined });
})
```

This flag interacts with the `output()` mode detection — see Output Modes below.

## Command Builder

Type-safe command construction:

```typescript
import { command } from "@outfitter/cli/command";

export const myCommand = command("my-command")
  .description("What this command does")
  .argument("<id>", "Required resource ID")
  .argument("[name]", "Optional name")
  .option("-l, --limit <n>", "Limit results", parseInt)
  .option("-v, --verbose", "Enable verbose output")
  .option("-t, --tags <tags...>", "Filter by tags")
  .action(async ({ args, flags }) => {
    // args.id: string
    // args.name: string | undefined
    // flags.limit: number | undefined
    // flags.verbose: boolean
    // flags.tags: string[] | undefined
  })
  .build();
```

## Output Modes

### Automatic Detection

```typescript
import { output } from "@outfitter/cli";

await output(data);  // Human by default
```

Default output is **always human**. Machine-readable output requires explicit opt-in via `--json` flag or `OUTFITTER_JSON=1` environment variable. This follows [clig.dev](https://clig.dev/) conventions.

### Mode Priority

1. Explicit `mode` option in code
2. `OUTFITTER_JSONL=1` env var
3. `OUTFITTER_JSON=1` env var
4. `OUTFITTER_JSON=0` forces human
5. Default: **human** (regardless of TTY)

### Forcing Modes

```typescript
import { output } from "@outfitter/cli";

// Force JSON
await output(data, { mode: "json" });

// Pretty-print JSON
await output(data, { mode: "json", pretty: true });

// Force human
await output(data, { mode: "human" });

// JSONL for streaming
for await (const item of items) {
  await output(item, { mode: "jsonl" });
}

// Output to stderr
await output(errorData, { stream: process.stderr });
```

For custom formatting, transform data before calling `output()`:

```typescript
await output(formatTable(data));
```

## Verbose Resolution

Environment-aware verbose mode via `resolveVerbose()`:

```typescript
import { resolveVerbose } from "@outfitter/cli/output";

const isVerbose = resolveVerbose();        // Auto-resolve from environment
const isVerbose = resolveVerbose(flags.verbose); // From CLI flag
```

**Precedence (highest wins):**

1. `OUTFITTER_VERBOSE` environment variable (`"1"` or `"0"`)
2. Explicit `verbose` parameter (from CLI flag)
3. `OUTFITTER_ENV` environment profile defaults
4. `false` (default)

### Environment Profiles

| `OUTFITTER_ENV` | Default verbose |
|-----------------|----------------|
| `development` | `true` |
| `production` | `false` |
| `test` | `false` |

## Error Handling

### Exit with Error

```typescript
import { exitWithError } from "@outfitter/cli/output";

const result = await handler(input, ctx);

if (result.isErr()) {
  exitWithError(result.error);  // Exit code from error category
}
```

`exitWithError` formats the error based on the current output mode (human or JSON) and exits with the appropriate exit code. In JSON mode, errors are serialized to stderr as JSON objects.

### Exit Code Mapping

| Category | Exit Code |
|----------|-----------|
| validation | 1 |
| not_found | 2 |
| conflict | 3 |
| permission | 4 |
| timeout | 5 |
| rate_limit | 6 |
| network | 7 |
| internal | 8 |
| auth | 9 |
| cancelled | 130 |

## Pagination

### Cursor State

Cursors persist in XDG state directory:

```
$XDG_STATE_HOME/{toolName}/cursors/{command}/cursor.json
```

### Using Pagination

```typescript
import { loadCursor, saveCursor, clearCursor } from "@outfitter/cli/pagination";

const options = { command: "list", toolName: "myapp" };

// Load previous cursor
const state = loadCursor(options);

// Fetch data with cursor
const results = await listItems({
  cursor: state?.cursor,
  limit: 20,
});

// Save for --next
if (results.hasMore) {
  saveCursor(results.nextCursor, options);
}

// Clear on --reset
if (flags.reset) {
  clearCursor(options);
}
```

### Cursor Expiration

```typescript
const state = loadCursor({
  ...options,
  maxAgeMs: 30 * 60 * 1000,  // 30 minutes
});
```

### Pagination Command Pattern

```typescript
import { command } from "@outfitter/cli/command";
import { output } from "@outfitter/cli";
import { exitWithError } from "@outfitter/cli/output";
import { loadCursor, saveCursor, clearCursor } from "@outfitter/cli/pagination";

export const listCommand = command("list")
  .option("-n, --next", "Continue from previous position")
  .option("--reset", "Reset pagination cursor")
  .option("-l, --limit <n>", "Results per page", parseInt, 20)
  .action(async ({ flags }) => {
    const paginationOpts = { command: "list", toolName: "myapp" };

    if (flags.reset) {
      clearCursor(paginationOpts);
      console.log("Cursor reset");
      return;
    }

    const cursor = flags.next ? loadCursor(paginationOpts)?.cursor : undefined;
    const result = await listHandler({ cursor, limit: flags.limit }, ctx);

    if (result.isErr()) {
      exitWithError(result.error);
    }

    await output(result.value.items, { mode: flags.json ? "json" : undefined });

    if (result.value.nextCursor) {
      saveCursor(result.value.nextCursor, paginationOpts);
      console.log("\nUse --next for more results");
    }
  })
  .build();
```

## Input Parsing

### Stdin Reading

```typescript
import { readStdin } from "@outfitter/cli/input";

const input = await readStdin();  // Returns string or null if no stdin
```

### Piped Detection

```typescript
import { isPiped } from "@outfitter/cli/input";

if (isPiped()) {
  const data = await readStdin();
} else {
  // Interactive mode
}
```

## Streaming

Interactive terminal updates via `@outfitter/cli/streaming`:

```typescript
import { createSpinner, createStreamWriter } from "@outfitter/cli/streaming";

// Spinner for async operations
const spinner = createSpinner("Loading...");
spinner.start();
await doWork();
spinner.succeed("Done!");

// Stream writer for in-place updates
const writer = createStreamWriter();
writer.write("Progress: 0%");
writer.update("Progress: 50%");
writer.update("Progress: 100%");
writer.persist();
```

## Rendering

Pure rendering functions from `@outfitter/cli/render`. All return strings — no side effects.

### Tables

```typescript
import { renderTable } from "@outfitter/cli/render";

const output = renderTable(data, {
  columns: ["name", "status", "updated"],
  headers: { name: "Name", status: "Status", updated: "Last Updated" },
});
```

### Formatting Utilities

```typescript
import { formatDuration, formatBytes, pluralize, slugify } from "@outfitter/cli/render";

formatDuration(1500);       // "1.5s"
formatDuration(65000);      // "1m 5s"
formatDuration(3661000);    // "1h 1m 1s"

formatBytes(1024);          // "1 KB"
formatBytes(1048576);       // "1 MB"

pluralize(1, "file");       // "1 file"
pluralize(5, "file");       // "5 files"
pluralize(2, "person", "people");  // "2 people"

slugify("Hello World");     // "hello-world"
slugify("Café Résumé");     // "cafe-resume"
```

### Date Parsing

```typescript
import { parseDateRange, formatRelative } from "@outfitter/cli/render";

const range = parseDateRange("last 7 days");
// { start: Date, end: Date }

const range2 = parseDateRange("2026-01-01..2026-01-31");
// { start: Date, end: Date }

formatRelative(new Date("2026-02-09")); // "yesterday"

// Supported formats:
// - "last N days/weeks/months"
// - "today", "yesterday", "this week", "this month"
// - "YYYY-MM-DD..YYYY-MM-DD" (range)
// - "YYYY-MM-DD" (single day)
```

## Best Practices

1. **Handler first** — Business logic in handler, CLI is thin adapter
2. **Output modes** — Support both human and JSON; use `--json` flag
3. **Exit codes** — Use `exitWithError` for consistent exit codes from error categories
4. **Human default** — Never assume JSON output; always default to human
5. **Pagination** — Use cursor state for `--next` functionality
6. **Stdin support** — Handle piped input via `readStdin()` and `isPiped()`
7. **Subpath imports** — Import from specific subpaths, not the root (except `output` and `ANSI`)
8. **Verbose resolution** — Use `resolveVerbose()` for environment-aware verbosity
