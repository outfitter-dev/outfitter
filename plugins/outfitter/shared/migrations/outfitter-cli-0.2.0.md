---
package: "@outfitter/cli"
version: 0.2.0
breaking: false
---

# @outfitter/cli → 0.2.0

## New APIs

### Portable `createCLI` from `@outfitter/cli/command`

`createCLI` and `command` are now available from the `@outfitter/cli/command` subpath export. This is the recommended import path for building CLIs.

```typescript
import { createCLI, command } from "@outfitter/cli/command";

const cli = createCLI({
  name: "my-tool",
  version: "1.0.0",
  description: "My CLI tool",
});

cli.register(
  command("hello <name>")
    .description("Greet someone")
    .action(async (name) => {
      console.log(`Hello, ${name}!`);
    })
);

await cli.parse(process.argv);
```

### Command Normalization

Command specs now separate the command name from argument syntax. The CLI framework handles parsing `"get <id>"` into a command named `get` with argument `<id>`.

```typescript
// Arguments are separated from the command name during registration
command("get <id>")          // name: "get", args: ["<id>"]
command("[directory]")       // name: undefined, args: ["[directory]"]
command("add <block>")       // name: "add", args: ["<block>"]
```

### `--json` Output Mode

Commands can support structured JSON output via the `--json` flag:

```typescript
import { output } from "@outfitter/cli/output";

// Human-readable (default)
await output(["Line 1", "Line 2"]);

// JSON mode (via --json flag or OUTFITTER_JSON=1)
await output({ users: [...] }, { mode: "json" });

// JSONL mode (for streaming)
await output(record, { mode: "jsonl" });
```

Mode is auto-detected:
1. Explicit `mode` option
2. `OUTFITTER_JSONL=1` env var → jsonl
3. `OUTFITTER_JSON=1` env var → json
4. Default fallback → human

### `pageSize` Prompt Option

Select and multi-select prompts now accept a `pageSize` option to control visible items:

```typescript
import { promptSelect, promptMultiSelect } from "@outfitter/cli/prompt";

const choice = await promptSelect({
  message: "Pick a template",
  options: [...],
  pageSize: 8, // Show 8 items at a time
});

const choices = await promptMultiSelect({
  message: "Select features",
  options: [...],
  pageSize: 6,
});
```

### `ANSI.inverse` + Theme Support

The `ANSI` constant now includes `inverse` for swapping foreground/background colors. Themes expose it as a function:

```typescript
import { ANSI } from "@outfitter/cli";

// Raw escape code
console.log(`${ANSI.inverse}Highlighted${ANSI.reset}`);

// Via theme
import { createTheme } from "@outfitter/cli";
const theme = createTheme();
console.log(theme.inverse("Highlighted"));
```

New theme semantic colors:
- `theme.accent(text)` — Cyan for interactive elements
- `theme.highlight(text)` — Bold for strong emphasis
- `theme.link(text)` — Cyan + underline for URLs
- `theme.destructive(text)` — Bright red for dangerous actions
- `theme.subtle(text)` — Dim gray for less prominent text

### `getSeverityIndicator()`

Severity-level indicator function for compliance and diagnostic output:

```typescript
import { getSeverityIndicator } from "@outfitter/cli/render";

getSeverityIndicator("minor");    // "◇"
getSeverityIndicator("moderate"); // "◆"
getSeverityIndicator("severe");   // "◈"

// Fallback for terminals without unicode
getSeverityIndicator("minor", false);    // "◊"
getSeverityIndicator("moderate", false); // "♦"
getSeverityIndicator("severe", false);   // "♦♦"
```

## Migration Steps

### Import `createCLI` from the command subpath

**Before:**
```typescript
import { createCLI } from "@outfitter/cli/cli";
```

**After:**
```typescript
import { createCLI, command } from "@outfitter/cli/command";
```

Both paths work, but `@outfitter/cli/command` is the canonical entry point.

## No Action Required

- Existing `output()` calls work unchanged — JSON mode is opt-in
- Theme color functions are backward-compatible (new colors are additive)
- `ANSI` constant additions don't affect existing usage
- Prompt APIs are backward-compatible (`pageSize` is optional)
