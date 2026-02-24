# CLI Flag and Argument Conventions

Composable flag presets for `@outfitter/cli`. Define flags once, resolve typed values, compose across commands.

## Quick Start

```typescript
import { command } from "@outfitter/cli/command";
import { composePresets, verbosePreset, cwdPreset } from "@outfitter/cli/flags";

const preset = composePresets(verbosePreset(), cwdPreset());

command("check")
  .preset(preset)
  .action<{ verbose: boolean; cwd: string }>(async ({ flags }) => {
    const { verbose, cwd } = preset.resolve(flags);
    // ...
  });
```

## Preset Catalog

### Core Presets (`@outfitter/cli/flags`)

| Preset                      | Flags                                                 | Resolved Type                                                                             | Default                 |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| `verbosePreset()`           | `-v, --verbose`                                       | `{ verbose: boolean }`                                                                    | `false`                 |
| `cwdPreset()`               | `--cwd <path>`                                        | `{ cwd: string }`                                                                         | `process.cwd()`         |
| `dryRunPreset()`            | `--dry-run`                                           | `{ dryRun: boolean }`                                                                     | `false`                 |
| `forcePreset()`             | `-f, --force`                                         | `{ force: boolean }`                                                                      | `false`                 |
| `interactionPreset()`       | `--non-interactive`, `--no-input`, `-y, --yes`        | `{ interactive: boolean; yes: boolean }`                                                  | `interactive: true`     |
| `strictPreset()`            | `--strict`                                            | `{ strict: boolean }`                                                                     | `false`                 |
| `colorPreset()`             | `--color [mode]`, `--no-color`                        | `{ color: "auto" \| "always" \| "never" }`                                                | `"auto"`                |
| `projectionPreset()`        | `--fields <a,b>`, `--exclude-fields <a,b>`, `--count` | `{ fields: string[] \| undefined; excludeFields: string[] \| undefined; count: boolean }` | all `undefined`/`false` |
| `paginationPreset(config?)` | `-l, --limit <n>`, `--next`, `--reset`                | `{ limit: number; next: boolean; reset: boolean }`                                        | `limit: 20`             |
| `timeWindowPreset(config?)` | `--since <date>`, `--until <date>`                    | `{ since: Date \| undefined; until: Date \| undefined }`                                  | `undefined`             |
| `executionPreset(config?)`  | `--timeout <ms>`, `--retries <n>`, `--offline`        | `{ timeout: number \| undefined; retries: number; offline: boolean }`                     | `retries: 0`            |

### Query Presets (`@outfitter/cli/query`)

| Preset                      | Flags                 | Resolved Type                                                       | Default     |
| --------------------------- | --------------------- | ------------------------------------------------------------------- | ----------- |
| `outputModePreset(config?)` | `-o, --output <mode>` | `{ outputMode: "human" \| "json" \| "jsonl" \| "tree" \| "table" }` | `"human"`   |
| `jqPreset()`                | `--jq <expr>`         | `{ jq: string \| undefined }`                                       | `undefined` |

## Composition

Presets compose with `composePresets()`. Options are deduplicated by preset `id` (first wins).

```typescript
const composed = composePresets(verbosePreset(), cwdPreset(), forcePreset());

// composed.options  → all three presets' options merged
// composed.resolve(flags) → { verbose, cwd, force }
```

## Creating Custom Presets

```typescript
import { createPreset, type FlagPreset } from "@outfitter/cli/flags";

type FormatFlags = { format: "table" | "csv" | "json" };

function formatPreset(): FlagPreset<FormatFlags> {
  return createPreset({
    id: "format",
    options: [
      {
        flags: "--format <type>",
        description: "Output format",
        defaultValue: "table",
      },
    ],
    resolve: (flags) => {
      const raw = flags["format"];
      const valid = new Set(["table", "csv", "json"]);
      return {
        format:
          typeof raw === "string" && valid.has(raw)
            ? (raw as FormatFlags["format"])
            : "table",
      };
    },
  });
}
```

## Configurable Presets

Some presets accept configuration:

```typescript
// Pagination with custom limits
paginationPreset({ defaultLimit: 50, maxLimit: 200 });

// Time window with max range guard
timeWindowPreset({ maxRange: 30 * 24 * 60 * 60 * 1000 }); // 30 days

// Execution with defaults
executionPreset({ defaultTimeout: 5000, defaultRetries: 3, maxRetries: 5 });

// Output modes
outputModePreset({
  modes: ["human", "json", "table"],
  defaultMode: "human",
  includeJsonl: true,
});
```

## Verb Conventions (`@outfitter/cli/verbs`)

Standard verb families for consistent command naming:

| Family   | Primary  | Aliases          | Description           |
| -------- | -------- | ---------------- | --------------------- |
| `create` | `create` | `new`            | Create a new resource |
| `modify` | `modify` | `edit`, `update` | Modify a resource     |
| `remove` | `remove` | `delete`, `rm`   | Remove a resource     |
| `list`   | `list`   | `ls`             | List resources        |
| `show`   | `show`   | `get`, `view`    | Show resource details |

```typescript
import { applyVerb, resolveVerb } from "@outfitter/cli/verbs";

// Resolve with overrides
const verb = resolveVerb("modify", { primary: "edit" });
// { name: "edit", aliases: ["update"] }

// Apply to command builder
applyVerb(builder, "list");
// Adds alias "ls" to the command
```

`resolveVerb` accepts a `VerbConfig` with additional options:

```typescript
// Disable all aliases
resolveVerb("remove", { aliases: false });
// { name: "remove", aliases: [] }

// Add extra aliases
resolveVerb("list", { extraAliases: ["all"] });
// { name: "list", aliases: ["ls", "all"] }

// Exclude specific aliases
resolveVerb("modify", { excludeAliases: ["update"] });
// { name: "modify", aliases: ["edit"] }
```

## Shell Completion (`@outfitter/cli/completion`)

```typescript
import { createCompletionCommand } from "@outfitter/cli/completion";

cli.register(createCompletionCommand({ programName: "mycli" }));
// mycli completion bash | zsh | fish
```

Restrict supported shells via the `shells` option:

```typescript
createCompletionCommand({ programName: "mycli", shells: ["bash", "zsh"] });
```

For build-time generation without a Commander command, use `generateCompletion()` directly:

```typescript
import { generateCompletion } from "@outfitter/cli/completion";

const script = generateCompletion("fish", "mycli");
await Bun.write("completions/mycli.fish", script);
```

## Schema Introspection (`@outfitter/cli/schema`)

Machine-readable introspection so agents can discover CLI capabilities without scraping `--help`.

### Auto-Registration

`buildCliCommands()` appends a `schema` command automatically:

```typescript
import { buildCliCommands } from "@outfitter/cli/actions";

const commands = buildCliCommands(registry);
// Includes all action commands + `schema` at the end
```

Opt out with `schema: false`:

```typescript
const commands = buildCliCommands(registry, { schema: false });
```

Pass options to the schema command:

```typescript
const commands = buildCliCommands(registry, {
  schema: { programName: "mycli" },
});
```

### Usage

```bash
mycli schema                        # Human-readable summary
mycli schema --output json          # Machine-readable JSON manifest
mycli schema --output json --pretty # Pretty-printed JSON
mycli schema --surface cli          # Filter by surface
mycli schema init                   # Detail view for a single action
```

### Manifest Shape

```typescript
interface ActionManifest {
  version: string; // Manifest format version ("1.0.0")
  generatedAt: string; // ISO 8601 timestamp
  surfaces: ActionSurface[]; // Surfaces present in registry
  actions: ActionManifestEntry[];
  errors: Record<ErrorCategory, { exit: number; http: number }>;
  outputModes: string[]; // ["human", "json", "jsonl", "tree", "table"]
}

interface ActionManifestEntry {
  id: string;
  description?: string;
  surfaces: ActionSurface[];
  input: JsonSchema; // Zod → JSON Schema conversion
  output?: JsonSchema;
  cli?: { group?; command?; description?; aliases?; options? };
  mcp?: { tool?; description?; deferLoading? };
  api?: { method?; path?; tags? };
}
```

### Surface Map Generation

Surface maps extend the manifest with envelope metadata for build-time generation and drift detection. The underlying types and logic live in `@outfitter/schema`; the CLI provides Commander subcommands.

#### Enabling Surface Subcommands

Pass `surface` options to enable `generate` and `diff` subcommands:

```typescript
const commands = buildCliCommands(registry, {
  schema: { programName: "mycli", surface: {} },
});
```

Or with custom paths:

```typescript
const commands = buildCliCommands(registry, {
  schema: {
    programName: "mycli",
    surface: { cwd: "/path/to/project", outputDir: ".outfitter" },
  },
});
```

#### Command Tree

```bash
mycli schema                          # show all (backward compat)
mycli schema init                     # show detail (backward compat)
mycli schema show [action]            # explicit show subcommand
mycli schema generate                 # write .outfitter/surface.json
mycli schema generate --dry-run       # print without writing
mycli schema generate --snapshot v1   # write .outfitter/snapshots/v1.json
mycli schema diff                     # compare runtime vs committed
mycli schema diff --output json       # structured diff as JSON
mycli schema diff --against v1        # compare runtime vs named snapshot
mycli schema diff --from v1 --to v2   # compare two snapshots
```

#### Surface Map Shape

```typescript
interface SurfaceMap extends ActionManifest {
  readonly $schema: string; // "https://outfitter.dev/surface/v1"
  readonly generator: "runtime" | "build";
}
```

#### CI Usage

Add drift detection to CI pipelines:

```bash
# Check for drift against committed surface.json (exits 1 on changes)
mycli schema diff
```

To bootstrap the baseline surface map (run once, then commit):

```bash
mycli schema generate
git add .outfitter/surface.json
```

Example GitHub Actions step:

```yaml
- name: Check schema drift
  run: |
    mycli schema diff
```

The diff compares the committed `.outfitter/surface.json` against the current runtime registry. It ignores volatile fields (`generatedAt`) and reports added, removed, and modified actions.

For cross-version comparison, use snapshots:

```bash
# Compare runtime against a specific release snapshot
mycli schema diff --against v1.0.0

# Compare two snapshots directly (no runtime involved)
mycli schema diff --from v1.0.0 --to v2.0.0
```

#### Programmatic Usage

```typescript
import {
  generateSurfaceMap,
  writeSurfaceMap,
  readSurfaceMap,
  diffSurfaceMaps,
} from "@outfitter/schema";

// Generate and write
const surfaceMap = generateSurfaceMap(registry, { generator: "build" });
await writeSurfaceMap(surfaceMap, ".outfitter/surface.json");

// Read and diff
const committed = await readSurfaceMap(".outfitter/surface.json");
const current = generateSurfaceMap(registry, { generator: "runtime" });
const diff = diffSurfaceMaps(committed, current);

if (diff.hasChanges) {
  console.log("Added:", diff.added);
  console.log("Removed:", diff.removed);
  console.log("Modified:", diff.modified);
}
```

### Standalone Usage

Use the module directly without auto-registration:

```typescript
import {
  generateManifest,
  formatManifestHuman,
  createSchemaCommand,
} from "@outfitter/cli/schema";

// Generate manifest programmatically
const manifest = generateManifest(registry, { surface: "cli" });

// Format for terminal
const output = formatManifestHuman(manifest, "mycli");

// Create a standalone Commander command
const schemaCmd = createSchemaCommand(registry, { programName: "mycli" });
```

## Action Registry Adoption

Presets integrate with `defineAction()` by spreading options and using `resolve()` in `mapInput`:

```typescript
const verbose = verbosePreset();
const cwd = cwdPreset();

defineAction({
  cli: {
    options: [
      ...verbose.options,
      ...cwd.options,
      { flags: "--ci", description: "CI mode", defaultValue: false },
    ],
    mapInput: (context) => ({
      ...verbose.resolve(context.flags),
      ...cwd.resolve(context.flags),
      ci: Boolean(context.flags["ci"]),
    }),
  },
});
```

## Migration Guide

### From Ad-Hoc Flags

Before:

```typescript
options: [
  { flags: "-v, --verbose", description: "Verbose output", defaultValue: false },
  { flags: "--cwd <path>", description: "Working directory" },
],
mapInput: (ctx) => ({
  verbose: Boolean(ctx.flags["verbose"]),
  cwd: typeof ctx.flags["cwd"] === "string" ? ctx.flags["cwd"] : process.cwd(),
}),
```

After:

```typescript
const verbose = verbosePreset();
const cwd = cwdPreset();

options: [...verbose.options, ...cwd.options],
mapInput: (ctx) => ({
  ...verbose.resolve(ctx.flags),
  ...cwd.resolve(ctx.flags),
}),
```

### From `--json` to `outputModePreset`

The global `--json` flag in `createCLI()` remains for backward compatibility. For new commands that need the full `--output` convention:

```typescript
import { outputModePreset } from "@outfitter/cli/query";

const mode = outputModePreset({ includeJsonl: true });

command("list")
  .preset(mode)
  .action(async ({ flags }) => {
    const { outputMode } = mode.resolve(flags);
    // outputMode is "human" | "json" | "jsonl" (or other configured OutputMode values)
  });
```

## Design Decisions

- **`type` not `interface`** for resolved flags — required to satisfy `Record<string, unknown>` constraint in `FlagPreset<T>`.
- **No `--json` preset** — the global `--json` flag in `createCLI()` already handles this via `OUTFITTER_JSON` env bridge. `outputModePreset` is for commands needing the full `--output <mode>` convention.
- **Presets resolve intent, not behavior** — `colorPreset()` resolves the user's intent (`"auto" | "always" | "never"`), consumers combine with `supportsColor()` from `@outfitter/cli/terminal/detection`.
- **Conflict detection is a handler concern** — `--fields` vs `--exclude-fields`, `--next` vs `--reset` are not enforced at the preset level. Document conflicts, let handlers decide.

## Guardrails and Exceptions

Two guardrail tests (run as part of the test suite) enforce convention boundaries:

- `apps/outfitter/src/__tests__/cli-convention-guardrails.test.ts` — catches ad-hoc `--json` option definitions and manual `OUTFITTER_JSON` env bridges in command files. New command files are automatically scanned.
- `packages/cli/src/__tests__/preset-boundary-guardrails.test.ts` — ensures only vetted preset exports exist in `@outfitter/cli/flags`, preventing unreviewed convention additions.

If a command needs intentional divergence (for example, an adapter that must
forward `--json` to another CLI), add the file to the test allowlist with a
short comment explaining why the exception is required.
