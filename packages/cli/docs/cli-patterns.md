# CLI Patterns

Advanced patterns for `@outfitter/cli` covering incremental migration, Commander integration, environment bridging, and preset composition.

## Incremental Registration with `cli.register()`

`createCLI()` returns a `CLI` instance whose `register()` method accepts both a `CommandBuilder` (from the fluent `command()` API) and a raw Commander `Command`. This enables incremental migration — existing Commander commands work alongside builder-style commands without rewriting everything at once.

### Builder-Style Commands

```typescript
import { createCLI, command } from "@outfitter/cli/command";
import { output } from "@outfitter/cli/output";

const cli = createCLI({
  name: "myapp",
  version: "1.0.0",
});

cli.register(
  command("list")
    .description("List items")
    .option("--limit <n>", "Max results", "20")
    .action(async ({ flags }) => {
      const items = await getItems(Number(flags["limit"]));
      output(items);
    })
);

await cli.parse();
```

### Raw Commander Commands

```typescript
import { createCLI } from "@outfitter/cli/command";
import { Command } from "commander";

const cli = createCLI({ name: "myapp", version: "1.0.0" });

// Existing Commander command — works as-is
const legacy = new Command("migrate")
  .description("Run database migrations")
  .option("--dry-run", "Preview changes")
  .action((opts) => {
    console.log("Migrating...", opts);
  });

cli.register(legacy);

await cli.parse();
```

### Mixing Both Styles

```typescript
import { createCLI, command } from "@outfitter/cli/command";
import { Command } from "commander";

const cli = createCLI({ name: "myapp", version: "1.0.0" });

// New builder-style command
cli.register(
  command("list")
    .description("List items")
    .action(async () => {
      /* ... */
    })
);

// Legacy Commander command — no changes needed
const legacyCmd = new Command("legacy-export").action(() => {
  /* ... */
});
cli.register(legacyCmd);

await cli.parse();
```

The detection works via duck typing: if the argument has a `build` method, it's treated as a `CommandBuilder` and `.build()` is called to extract the underlying `Command`. Otherwise it's added directly via `program.addCommand()`.

`register()` returns the `CLI` instance for chaining:

```typescript
cli.register(listCmd).register(showCmd).register(deleteCmd);
```

## `exitOverride` Behavior

`createCLI()` calls Commander's `program.exitOverride()` internally. This is not optional — it's always applied. Here's why and what it means for your code.

### Why `exitOverride` is Used

Commander normally calls `process.exit()` directly for help display, version output, and errors. `exitOverride()` makes Commander throw instead, so `createCLI` can route **all** exits through a single configurable hook.

### How It Works

When Commander would exit (help display, version output, parse errors), it throws an error with a `.code` property instead. The `parse()` method catches these:

- **Help/version** (`commander.helpDisplayed`, `commander.version`, `commander.help`) → calls `onExit(0)`
- **Parse errors** (missing required options, unknown flags) → calls `onError` if configured, then `onExit(exitCode)`
- **Successful execution** → normal return

### Configuring Exit Behavior

The `CLIConfig` interface provides two hooks:

```typescript
import { createCLI } from "@outfitter/cli/command";

const cli = createCLI({
  name: "myapp",
  version: "1.0.0",

  // Called on errors before exit (optional)
  onError: (error) => {
    logger.error("CLI error", { error: error.message });
  },

  // Called for ALL exits — defaults to process.exit()
  onExit: async (code) => {
    await cleanup();
    process.exit(code);
  },
});
```

The `onExit` hook supports async operations — useful for flushing logs, closing connections, or cleanup before the process terminates.

### Testing Implications

`exitOverride` makes CLIs testable without mocking `process.exit`. Provide a custom `onExit` that captures the exit code instead of terminating:

```typescript
let exitCode: number | undefined;

const cli = createCLI({
  name: "test-cli",
  version: "0.0.0",
  onExit: (code) => {
    exitCode = code;
  },
});

// Parse will call onExit(0) for --help instead of process.exit(0)
await cli.parse(["node", "test-cli", "--help"]);
expect(exitCode).toBe(0);
```

## `OUTFITTER_JSON` Environment Variable Bridge

`createCLI()` installs a `preAction` / `postAction` hook pair that bridges the `--json` flag into the `OUTFITTER_JSON` environment variable. This is how `output()` auto-detects JSON mode without manual branching.

### The Bridge Mechanism

1. `createCLI()` registers a global `--json` flag on the root program
2. A `preAction` hook checks `optsWithGlobals()` for `json === true`
3. If set, the hook saves the current `OUTFITTER_JSON` env value and sets `OUTFITTER_JSON=1`
4. After the action completes, a `postAction` hook restores the previous value
5. A `finally` block in `parse()` also restores the value (safety net for thrown errors)

### Why This Exists

`output()` detects mode from environment variables — it doesn't receive flags directly. The bridge means any command using `output()` automatically respects `--json` without extra wiring:

```typescript
import { output } from "@outfitter/cli/output";

// No need for conditional format logic:
// ❌ if (opts.json) output(data, "json"); else output(data);

// Just call output() — the bridge handles it:
// ✅
output(data);
```

### Global vs Subcommand Flags

The `--json` flag is registered globally. The bridge uses `optsWithGlobals()`, so both placements work:

```bash
# Global placement
myapp --json list

# After subcommand (Commander coalesces globals)
myapp list --json
```

Subcommands should **not** define their own `--json` flag — use the global one. If they do, both coalesce safely through `optsWithGlobals()`.

### Env Var Restoration

The bridge preserves the previous `OUTFITTER_JSON` value and restores it after the action completes. This means:

- If `OUTFITTER_JSON` was already set externally, it's restored after the command runs
- If it was unset, it returns to `undefined`
- The `finally` block in `parse()` ensures restoration even on error paths

## Preset Composition Patterns

Flag presets bundle option definitions with typed resolvers. Compose them to build consistent command interfaces without duplicating flag logic.

### Using a Single Preset

Apply a preset to a command with `.preset()`:

```typescript
import { command } from "@outfitter/cli/command";
import { outputModePreset } from "@outfitter/cli/query";

const mode = outputModePreset({ includeJsonl: true });

command("list")
  .description("List items")
  .preset(mode)
  .action(async ({ flags }) => {
    const { outputMode } = mode.resolve(flags);
    // outputMode: "human" | "json" | "jsonl"
  });
```

### Composing Multiple Presets

Use `composePresets()` from `@outfitter/cli/flags` to merge multiple presets into one. Options are deduplicated by preset `id` (first occurrence wins):

```typescript
import { composePresets, cwdPreset, verbosePreset } from "@outfitter/cli/flags";
import { outputModePreset } from "@outfitter/cli/query";

const preset = composePresets(outputModePreset(), cwdPreset(), verbosePreset());

command("build")
  .description("Build the project")
  .preset(preset)
  .action(async ({ flags }) => {
    const { outputMode, cwd, verbose } = preset.resolve(flags);
  });
```

### Mixing Presets with Custom Flags

Presets and manual `.option()` calls work together. Custom flags appear in the `flags` object alongside preset-resolved values:

```typescript
import {
  composePresets,
  dryRunPreset,
  forcePreset,
} from "@outfitter/cli/flags";
import { outputModePreset } from "@outfitter/cli/query";

const preset = composePresets(
  outputModePreset(),
  dryRunPreset(),
  forcePreset()
);

command("deploy <env>")
  .description("Deploy to environment")
  .preset(preset)
  .option("--tag <tag>", "Deploy tag")
  .action(async ({ args, flags }) => {
    const [env] = args;
    const { outputMode, dryRun, force } = preset.resolve(flags);
    const tag = flags["tag"] as string | undefined;
  });
```

### Creating Custom Presets

Use `createPreset()` for domain-specific flag bundles:

```typescript
import { createPreset } from "@outfitter/cli/flags";

const authPreset = createPreset({
  id: "auth",
  options: [
    { flags: "--token <token>", description: "API token" },
    { flags: "--profile <name>", description: "Auth profile" },
  ],
  resolve: (flags) => ({
    token: typeof flags["token"] === "string" ? flags["token"] : undefined,
    profile:
      typeof flags["profile"] === "string" ? flags["profile"] : "default",
  }),
});
```

Typed custom flag builders are available for common patterns:

```typescript
import { booleanFlagPreset, enumFlagPreset } from "@outfitter/cli/flags";

const watchPreset = booleanFlagPreset({
  id: "watch",
  key: "watch",
  flags: "-w, --watch",
  description: "Watch for changes",
  defaultValue: false,
});

const formatPreset = enumFlagPreset({
  id: "format",
  key: "format",
  flags: "--format <type>",
  description: "Output format",
  values: ["table", "csv", "yaml"] as const,
  defaultValue: "table",
});
```

### Deduplication in Composition

`composePresets()` deduplicates by preset `id`. If two presets share an `id`, the first one wins:

```typescript
import { composePresets, verbosePreset } from "@outfitter/cli/flags";

// Second verbosePreset() is ignored — same id
const preset = composePresets(verbosePreset(), verbosePreset());
// Only one --verbose flag in the resulting command
```

This is useful when composing higher-level preset groups that may internally include the same base preset.

### Built-in Preset Catalog

| Preset                | Import Path            | Flags Added                                    | Resolved Type                                            |
| --------------------- | ---------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `outputModePreset()`  | `@outfitter/cli/query` | `-o, --output <mode>`                          | `{ outputMode: OutputMode }`                             |
| `jqPreset()`          | `@outfitter/cli/query` | `--jq <expr>`                                  | `{ jq: string \| undefined }`                            |
| `verbosePreset()`     | `@outfitter/cli/flags` | `-v, --verbose`                                | `{ verbose: boolean }`                                   |
| `cwdPreset()`         | `@outfitter/cli/flags` | `--cwd <path>`                                 | `{ cwd: string }`                                        |
| `dryRunPreset()`      | `@outfitter/cli/flags` | `--dry-run`                                    | `{ dryRun: boolean }`                                    |
| `forcePreset()`       | `@outfitter/cli/flags` | `-f, --force`                                  | `{ force: boolean }`                                     |
| `interactionPreset()` | `@outfitter/cli/flags` | `--non-interactive`, `--no-input`, `-y, --yes` | `{ interactive: boolean, yes: boolean }`                 |
| `strictPreset()`      | `@outfitter/cli/flags` | `--strict`                                     | `{ strict: boolean }`                                    |
| `colorPreset()`       | `@outfitter/cli/flags` | `--color [mode]`, `--no-color`                 | `{ color: ColorMode }`                                   |
| `projectionPreset()`  | `@outfitter/cli/flags` | `--fields`, `--exclude-fields`, `--count`      | `{ fields, excludeFields, count }`                       |
| `paginationPreset()`  | `@outfitter/cli/flags` | `-l, --limit <n>`, `--next`, `--reset`         | `{ limit: number, next: boolean, reset: boolean }`       |
| `timeWindowPreset()`  | `@outfitter/cli/flags` | `--since <date>`, `--until <date>`             | `{ since: Date \| undefined, until: Date \| undefined }` |
| `executionPreset()`   | `@outfitter/cli/flags` | `--timeout <ms>`, `--retries <n>`, `--offline` | `{ timeout, retries, offline }`                          |

### Centralized Output Mode Resolution

For action-level code that needs both the mode **and** how it was determined, use `resolveOutputMode()` from `@outfitter/cli/query`:

```typescript
import { resolveOutputMode } from "@outfitter/cli/query";

const { mode, source } = resolveOutputMode(context.flags);
// mode: "human" | "json" | "jsonl"
// source: "flag" | "env" | "default"

if (source === "flag") {
  // User explicitly requested this mode
}
```

Resolution order (highest wins):

1. Explicit `--output` / `-o` flag → source: `"flag"`
2. Legacy `--json` / `--jsonl` boolean flags → source: `"flag"`
3. `OUTFITTER_JSONL=1` / `OUTFITTER_JSON=1` env vars → source: `"env"`
4. Configured default (typically `"human"`) → source: `"default"`

See [output-modes.md](./output-modes.md) for mode details and the `--jq` flag.
