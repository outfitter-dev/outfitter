# @outfitter/cli Harvest Map

This document catalogs CLI patterns discovered in waymark and firewatch codebases, mapping them to the @outfitter/cli implementation plan defined in SPEC.md.

## Source Repositories

### waymark/packages/cli

**Path**: `~/Developer/outfitter/waymark/packages/cli/`

**Key files analyzed**:

| File | Purpose |
|------|---------|
| `src/exit-codes.ts` | Standardized exit code constants |
| `src/errors.ts` | CliError class with exit code mapping |
| `src/program.ts` | Commander.js program builder, command registration |
| `src/utils/output.ts` | JSON/JSONL/text rendering helpers |
| `src/utils/stdin.ts` | stdin stream reading utilities |
| `src/utils/terminal.ts` | TTY detection, color support detection |
| `src/utils/flags/*.ts` | Flag parsing utilities (json, string-list, iterator) |
| `src/utils/display/pagination.ts` | Basic pagination (slice-based) |
| `src/utils/display/formatters/styles.ts` | Chalk-based styling utilities |
| `src/types.ts` | GlobalOptions, CommandContext types |

### firewatch/apps/cli

**Path**: `~/Developer/outfitter/firewatch/apps/cli/`

**Key files analyzed**:

| File | Purpose |
|------|---------|
| `bin/fw.ts` | Entrypoint with graceful shutdown handlers |
| `src/index.ts` | Commander.js program with extensive option parsing |
| `src/utils/json.ts` | JSONL output with backpressure handling |
| `src/utils/tty.ts` | TTY detection with env var overrides |
| `src/utils/color.ts` | Lazy-initialized ansis color handling |
| `src/commands/ack.ts` | Command example with structured output |

---

## Pattern Categories

### 1. Output Patterns

#### JSON/JSONL Handling

**Source**: `firewatch/apps/cli/src/utils/json.ts:5-30`

```typescript
export async function writeJsonLine(value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const line = `${serialized ?? "null"}\n`;
  if (!process.stdout.write(line)) {
    await once(process.stdout, "drain");
  }
}

export async function outputStructured(
  value: unknown,
  format: OutputFormat
): Promise<void> {
  if (format === "json") {
    const serialized = JSON.stringify(value, null, 2);
    const line = `${serialized ?? "null"}\n`;
    if (!process.stdout.write(line)) {
      await once(process.stdout, "drain");
    }
    return;
  }

  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    await writeJsonLine(item);
  }
}
```

**Key insight**: Backpressure handling with `once(process.stdout, "drain")` is essential for large outputs piped to slower consumers.

**Source**: `waymark/packages/cli/src/utils/output.ts:57-83`

```typescript
export function renderRecords(
  records: WaymarkRecord[],
  format: ScanOutputFormat
): string {
  if (records.length === 0) {
    return "";
  }
  const cleanedRecords = records.map(cleanRecord);

  switch (format) {
    case "json":
      return JSON.stringify(cleanedRecords);
    case "jsonl":
      return cleanedRecords.map((record) => JSON.stringify(record)).join("\n");
    case "text":
      return JSON.stringify(cleanedRecords, null, 2);
    default:
      return records
        .map(
          (record) =>
            `${record.file}:${record.startLine} ${record.type} ::: ${record.contentText}`
        )
        .join("\n");
  }
}
```

**Key insight**: Waymark uses sync string building, suitable for smaller outputs. Kit should support both patterns based on output size.

#### TTY Detection

**Source**: `firewatch/apps/cli/src/utils/tty.ts:23-70`

```typescript
export function shouldOutputJson(
  options: OutputModeOptions,
  defaultFormat?: "human" | "json"
): boolean {
  // Explicit flag takes precedence
  if (options.jsonl === true) return true;
  if (options.jsonl === false) return false;
  if (options.json === true) return true;
  if (options.json === false) return false;

  // Environment variable (prefer JSONL)
  if (process.env.FIREWATCH_JSONL === "1") return true;
  if (process.env.FIREWATCH_JSONL === "0") return false;
  if (process.env.FIREWATCH_JSON === "1") return true;
  if (process.env.FIREWATCH_JSON === "0") return false;

  if (defaultFormat === "json") return true;
  if (defaultFormat === "human") return false;

  // TTY detection - if not a TTY (piped), default to JSON
  if (!process.stdout.isTTY) return true;

  // Interactive terminal - default to human-readable
  return false;
}
```

**Key insight**: Priority cascade: explicit flag > env var > config default > TTY detection. This is the blessed pattern for Kit.

**Source**: `waymark/packages/cli/src/utils/terminal.ts:36-53`

```typescript
export function shouldUseColor(noColorFlag?: boolean): boolean {
  if (noColorFlag) return false;
  if (hasNoColor()) return false;  // NO_COLOR env
  if (hasForceColor()) return true; // FORCE_COLOR env
  if (!process.stdout.isTTY) return false;
  if (isDumbTerminal()) return false; // TERM=dumb
  return true;
}
```

**Key insight**: Respects `NO_COLOR`, `FORCE_COLOR`, and `TERM=dumb` conventions. Kit MUST honor these.

#### Color Handling

**Source**: `firewatch/apps/cli/src/utils/color.ts:1-61`

```typescript
let colorInstance: Ansis | null = null;

function shouldUseColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  if (process.env.TERM === "dumb") return false;
  return process.stdout.isTTY ?? false;
}

export function getAnsis(): Ansis {
  if (colorInstance) return colorInstance;

  if (shouldUseColor()) {
    colorInstance = ansis;
  } else {
    colorInstance = new Ansis(0);
  }
  return colorInstance;
}

export function resetColorInstance(): void {
  colorInstance = null;
}
```

**Key insight**: Lazy initialization allows CLI flags to be processed before color decision. Essential for `--no-color` to work correctly.

---

### 2. Input Patterns

#### Flag Parsing (Iterator Pattern)

**Source**: `waymark/packages/cli/src/utils/flags/iterator.ts:6-75`

```typescript
export class ArgIterator {
  private index = 0;
  private readonly argv: readonly string[];

  constructor(argv: readonly string[]) {
    this.argv = argv;
  }

  hasNext(): boolean {
    return this.index < this.argv.length;
  }

  next(): string | undefined {
    if (!this.hasNext()) return;
    const value = this.argv[this.index];
    this.index += 1;
    return value;
  }

  peek(): string | undefined {
    return this.argv[this.index];
  }

  consumeValue(optionName: string): string {
    const value = this.next();
    if (typeof value !== "string" || isFlag(value)) {
      throw new Error(`${optionName} requires a value`);
    }
    return value;
  }
}

export function isFlag(token: string | undefined): boolean {
  return typeof token === "string" && token.startsWith("-");
}

export function matchesFlag(
  token: string | undefined,
  names: readonly string[]
): boolean {
  if (typeof token !== "string") return false;
  return names.includes(token);
}
```

**Key insight**: Custom arg iterator with lookahead. Kit uses Commander.js but this pattern is useful for custom parsing.

#### CSV/List Parsing

**Source**: `firewatch/apps/cli/src/index.ts:96-157`

```typescript
function parseCsvList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePrList(value: string | boolean | undefined): number[] {
  if (!value || value === true) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      if (Number.isNaN(parsed)) {
        throw new TypeError(`Invalid PR number: ${part}`);
      }
      return parsed;
    });
}

function parseAuthorFilters(value?: string): {
  include: string[];
  exclude: string[];
} {
  const items = parseCsvList(value);
  const include: string[] = [];
  const exclude: string[] = [];

  for (const item of items) {
    if (item.startsWith("!")) {
      const trimmed = item.slice(1).trim();
      if (trimmed) exclude.push(trimmed);
    } else {
      include.push(item);
    }
  }

  return { include, exclude };
}
```

**Key insight**: Pattern for include/exclude lists with `!` prefix. Kit should standardize this pattern.

#### stdin Reading

**Source**: `waymark/packages/cli/src/utils/stdin.ts:8-28`

```typescript
export async function readStream(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readFromStdin(): Promise<string> {
  return await readStream(process.stdin);
}
```

**Key insight**: Simple async stdin reading. Kit should expand this to support `@-` and `-` conventions.

---

### 3. Error Patterns

#### Exit Codes

**Source**: `waymark/packages/cli/src/exit-codes.ts:3-11`

```typescript
export const ExitCode = {
  success: 0,
  failure: 1,
  usageError: 2,
  configError: 3,
  ioError: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
```

**Key insight**: Waymark uses a simple 5-code system. SPEC.md defines a more comprehensive mapping based on error categories.

#### Error Classes

**Source**: `waymark/packages/cli/src/errors.ts:5-31`

```typescript
export class CliError extends Error {
  exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function createUsageError(message: string): CliError {
  return new CliError(message, ExitCode.usageError);
}

export function createConfigError(message: string): CliError {
  return new CliError(message, ExitCode.configError);
}
```

**Key insight**: Factory functions for common error types. Kit should build on this but derive from KitError base.

#### Error Resolution

**Source**: `waymark/packages/cli/src/program.ts:106-142`

```typescript
function resolveCommanderExitCode(error: CommanderError): ExitCode {
  if (error.exitCode === 0) return ExitCode.success;
  if (error.code.startsWith("commander.")) return ExitCode.usageError;
  return (error.exitCode ?? ExitCode.failure) as ExitCode;
}

function resolveExitCode(error: unknown): ExitCode {
  if (error instanceof CliError) return error.exitCode;
  if (error instanceof CommanderError) return resolveCommanderExitCode(error);
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  ) {
    return ExitCode.ioError;
  }
  return ExitCode.failure;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Unexpected error";
}
```

**Key insight**: Robust error type detection including Commander.js errors and Node.js errno errors.

#### Error Serialization for JSON Output

**Source**: `firewatch/apps/cli/src/commands/ack.ts:221-233`

```typescript
if (outputJson) {
  await outputStructured(
    {
      ok: true,
      repo,
      ...(pr !== undefined && { pr }),
      id: shortId,
      gh_id: commentId,
      removed,
    },
    "jsonl"
  );
  return;
}
```

**Key insight**: Structured output uses `{ ok: boolean, ... }` envelope pattern. Kit formalizes this as `Envelope<T>`.

---

### 4. Pagination Patterns

#### Basic Pagination (What Exists)

**Source**: `waymark/packages/cli/src/utils/display/pagination.ts:13-28`

```typescript
export function paginateRecords(
  records: WaymarkRecord[],
  limit?: number,
  page?: number
): WaymarkRecord[] {
  if (!(limit || page)) return records;

  const pageSize = limit || DEFAULT_PAGE_SIZE;
  const pageNumber = page || 1;
  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return records.slice(startIndex, endIndex);
}
```

**Source**: `waymark/packages/cli/src/utils/display/types.ts:19-21`

```typescript
export const DEFAULT_PAGE_SIZE = 50;
```

**Key insight**: Waymark uses simple offset/limit pagination with in-memory slicing. Firewatch similarly uses `--limit` and `--offset` options.

**What's missing**: Cursor persistence, `--next` flag, context-scoped state buckets. These are spec-driven features.

---

### 5. Command Structure Patterns

#### Commander.js Usage

**Source**: `waymark/packages/cli/src/program.ts:1116-1243`

```typescript
export async function createProgram(): Promise<Command> {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = await import(packageJsonPath.href);
  const version = packageJson.default.version as string;

  const program = new Command();
  program.exitOverride((error) => {
    const exitCode = resolveCommanderExitCode(error);
    process.exit(exitCode);
  });

  const jsonOption = new Option("--json", "Output as JSON array");
  const jsonlOption = new Option("--jsonl", "Output as JSON Lines");
  const textOption = new Option("--text", "Output as human-readable text");
  jsonOption.conflicts("jsonl");
  jsonOption.conflicts("text");
  jsonlOption.conflicts("json");
  jsonlOption.conflicts("text");
  textOption.conflicts("json");
  textOption.conflicts("jsonl");

  program
    .name("wm")
    .description("Waymark CLI - scan, filter, format, and manage waymarks")
    .version(version, "--version, -v", "output the current version")
    .helpOption("--help, -h", "display help for command")
    .addHelpCommand(false)
    .configureHelp({
      formatHelp: buildCustomHelpFormatter(),
    })
    .addOption(new Option("--scope <scope>", "config scope")
      .choices(["default", "project", "user"])
      .default("default"))
    .option("--config <path>", "load additional config file")
    .option("--cache", "use scan cache")
    .option("--no-input", "fail if interactive input required")
    .option("--verbose", "enable verbose logging")
    .option("--debug", "enable debug logging")
    .option("--quiet, -q", "only show errors")
    .addOption(jsonOption)
    .addOption(jsonlOption)
    .addOption(textOption)
    .option("--no-color", "disable ANSI colors")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      setPromptPolicy({ noInput: Boolean(opts.noInput) });
      if (opts.debug) logger.level = "debug";
      else if (opts.verbose) logger.level = "info";
      else if (opts.quiet) logger.level = "error";
    });

  registerCommands(program, { /* handlers */ });

  return program;
}
```

**Key insight**: Option conflicts declared explicitly. Global options handled in `preAction` hook. Version from package.json.

**Source**: `firewatch/apps/cli/src/index.ts:407-456`

```typescript
const program = new Command();
program.enablePositionalOptions();

program
  .name("fw")
  .description("GitHub PR activity logger")
  .version(version)
  .option("--pr [numbers]", "Filter to PR domain")
  .option("--repo <name>", "Filter to specific repository")
  .option("--all", "Include all cached repos")
  .option("--mine", "Items on PRs assigned to me")
  .option("--reviews", "PRs I need to review")
  .option("-s, --since <duration>", "Filter by time window")
  .option("--offline", "Use cache only")
  .option("--refresh [full]", "Force sync before query")
  .option("-n, --limit <count>", "Limit results", Number.parseInt)
  .option("--offset <count>", "Skip first N results", Number.parseInt)
  .option("--summary", "Aggregate entries")
  .option("-j, --jsonl", "Force structured output")
  .option("--no-jsonl", "Force human-readable output")
  .option("--debug", "Enable debug logging")
  .option("--no-color", "Disable color output")
  .addHelpText("after", "Examples:\n  ...")
  .action(async (options) => { /* ... */ });
```

**Key insight**: `enablePositionalOptions()` for better positional arg handling. Example text in help.

#### Signal Handling

**Source**: `waymark/packages/cli/src/program.ts:161-176`

```typescript
let signalHandlersRegistered = false;
const SIGINT_EXIT_CODE = 130;
const SIGTERM_EXIT_CODE = 143;

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) return;
  signalHandlersRegistered = true;
  process.once("SIGINT", () => process.exit(SIGINT_EXIT_CODE));
  process.once("SIGTERM", () => process.exit(SIGTERM_EXIT_CODE));
}
```

**Source**: `firewatch/apps/cli/bin/fw.ts:15-47`

```typescript
function setupShutdownHandlers(): void {
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    closeFirewatchDb();
  };

  process.on("exit", shutdown);
  process.on("SIGINT", () => { shutdown(); process.exit(0); });
  process.on("SIGTERM", () => { shutdown(); process.exit(0); });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    shutdown();
    process.exit(1);
  });
}
```

**Key insight**: Firewatch does cleanup (DB close) on shutdown. Kit should provide shutdown hooks for resource cleanup.

#### Spinner Pattern

**Source**: `waymark/packages/cli/src/program.ts:78-89`

```typescript
function shouldEnableSpinner(options: {
  quiet?: boolean;
  structuredOutput?: boolean;
}): boolean {
  if (options.structuredOutput) return false;
  if (options.quiet) return false;
  return Boolean(process.stderr.isTTY);
}
```

**Key insight**: Spinners disabled for quiet mode and structured output. Use stderr for spinners.

---

## Code Snippets to Adapt

### Output Mode Selection (from firewatch)

Kit should generalize this pattern:

```typescript
// @outfitter/cli output mode detection
export function resolveOutputMode(options: {
  json?: boolean;
  jsonl?: boolean;
  text?: boolean;
}, config?: { defaultFormat?: "human" | "json" }): OutputMode {
  // Explicit flags first
  if (options.json) return "json";
  if (options.jsonl) return "jsonl";
  if (options.text) return "text";
  
  // Env var override (generic pattern)
  const envJson = process.env[`${APP_PREFIX}_JSON`];
  const envJsonl = process.env[`${APP_PREFIX}_JSONL`];
  if (envJsonl === "1") return "jsonl";
  if (envJson === "1") return "json";
  if (envJsonl === "0" || envJson === "0") return "text";
  
  // Config default
  if (config?.defaultFormat === "json") return "jsonl";
  
  // TTY detection
  return process.stdout.isTTY ? "text" : "jsonl";
}
```

### Standardized Exit Code Mapping (extending waymark)

```typescript
// @outfitter/cli exit codes (mapped from ErrorCategory)
export const ExitCode = {
  success: 0,
  validation: 1,     // Bad input, invalid flags
  not_found: 2,      // Resource not found
  conflict: 3,       // State conflict, version mismatch
  permission: 4,     // Auth/authz failure
  io: 5,             // File/network/database I/O
  transient: 6,      // Retry-able failure
  internal: 7,       // Bug, unexpected state
  cancelled: 8,      // User cancelled (Ctrl+C handled separately)
} as const;
```

### Backpressure-Aware JSONL (from firewatch)

```typescript
// @outfitter/cli streaming output
import { once } from "node:events";

export async function writeJsonl<T>(
  items: AsyncIterable<T> | Iterable<T>,
  stream: NodeJS.WritableStream = process.stdout
): Promise<void> {
  for await (const item of items) {
    const line = JSON.stringify(item) + "\n";
    if (!stream.write(line)) {
      await once(stream, "drain");
    }
  }
}
```

### Lazy Color Initialization (from firewatch)

```typescript
// @outfitter/cli color utilities (using Bun.color)
let colorEnabled: boolean | null = null;

export function shouldUseColor(): boolean {
  if (colorEnabled !== null) return colorEnabled;
  
  if (process.env.NO_COLOR) colorEnabled = false;
  else if (process.env.FORCE_COLOR) colorEnabled = true;
  else if (process.env.TERM === "dumb") colorEnabled = false;
  else colorEnabled = process.stdout.isTTY ?? false;
  
  return colorEnabled;
}

export function resetColorDecision(): void {
  colorEnabled = null;
}
```

---

## Patterns NOT Suitable for Kit

### 1. Waymark-specific Styling (styles.ts)

The extensive chalk-based styling for waymark syntax (tags, mentions, properties) is domain-specific. Kit provides semantic tokens via `@outfitter/ui`; individual CLIs style their domain objects.

**Reason**: Too coupled to waymark grammar. Kit tokens are semantic (success, warning, danger), not domain-specific.

### 2. Record Cleaning Logic (output.ts cleanRecord)

Waymark's record cleaning removes empty arrays and specific fields. This is schema-specific.

**Reason**: Kit handles generic JSON output. Schema-aware cleaning belongs in domain handlers.

### 3. Waymark-specific Iterator Patterns

The custom flag parsing with `handleStringListFlag`, `handleJsonFlag`, etc., works around Commander.js limitations for waymark's unified command. Kit relies on Commander.js native patterns.

**Reason**: Over-engineering for Kit's scope. Commander.js handles most cases.

### 4. Firewatch-specific Repo Detection

The `detectRepo()`, `ensureRepoCache()`, and GitHub-specific patterns are firewatch domain logic.

**Reason**: Not generalizable CLI infrastructure.

---

## Spec-Driven Features

These features are defined in SPEC.md but do NOT exist in waymark or firewatch. They must be built fresh for Kit.

### 1. Cursor Persistence (`--next` flag)

**SPEC.md requirement**: "Pagination state is persisted **per command**. `--next` continues from persisted state. `--reset` clears the persisted state."

**What exists**: Waymark/firewatch have offset-based pagination but no state persistence.

**Kit implementation needed**:
- State storage in `@outfitter/state` (XDG state directory)
- Per-command cursor serialization
- `--next` flag that loads last cursor
- `--reset` flag that clears cursor

### 2. Context-Scoped State Buckets (`--context` flag)

**SPEC.md requirement**: "A user-supplied context key scopes state buckets. Preferred flag name: `--context <name>`."

**What exists**: Neither repo implements this.

**Kit implementation needed**:
- State keyed by `(command, context)` tuple
- Default context when not specified
- State isolation between contexts

### 3. @file Expansion Convention

**SPEC.md requirement**: "`@file` for file-sourced inputs. `@` prefix may also be used to disambiguate identifiers."

**What exists**: Neither repo implements this systematically.

**Kit implementation needed**:
- `expandFileArg()` utility that reads `@path` files
- Integration with `collectIds()` for multi-ID collection
- Support for `@-` reading from stdin

### 4. Workspace-Constrained Globs

**SPEC.md requirement**: "`parseGlob()` — Glob pattern expansion with workspace constraints."

**What exists**: Waymark has workspace detection but no constrained glob expansion.

**Kit implementation needed**:
- `parseGlob()` that enforces paths stay within workspace
- Integration with `@outfitter/file-ops` for `secureResolvePath()`
- Error on glob patterns that escape workspace

### 5. Result-Based Error Handling

**SPEC.md requirement**: All handlers return `Result<T, E>` with `KitError` subclasses.

**What exists**: Waymark/firewatch use thrown exceptions.

**Kit implementation needed**:
- CLI adapter converts `Result.err()` to appropriate exit code
- Structured error serialization for `--json` output
- Error envelope format: `{ ok: false, error: { _tag, message, ... } }`

### 6. Shape-Based Output System

**SPEC.md requirement**: Semantic shapes (`Collection`, `Hierarchy`, `KeyValue`, `Resource`) that render to any mode.

**What exists**: Waymark has formatters but no shape abstraction. Firewatch has no abstraction.

**Kit implementation needed**:
- `@outfitter/ui` shapes
- `@outfitter/cli` output() function that auto-selects renderer
- Integration with `--json`, `--jsonl`, `--tree`, `--table` flags

### 7. Handler Contract

**SPEC.md requirement**: "CLI and MCP are thin adapters over shared handlers."

**What exists**: Waymark has some handler separation. Firewatch mixes command logic with output.

**Kit implementation needed**:
- Clear handler interface: `(input, ctx) => Promise<Result<T, E>>`
- CLI adapter that maps flags to handler input
- Handler knows nothing about output format

---

## Harvest Priority

Based on SPEC.md and existing patterns:

| Priority | Feature | Source | Notes |
|----------|---------|--------|-------|
| P0 | Exit code constants | waymark | Extend with full error category mapping |
| P0 | Output mode detection | firewatch | Generalize env var pattern |
| P0 | TTY/color detection | both | Combine best of both |
| P0 | JSONL with backpressure | firewatch | Critical for streaming |
| P1 | Commander.js patterns | waymark | Option conflicts, hooks, help customization |
| P1 | CSV parsing utilities | firewatch | Standardize include/exclude pattern |
| P1 | Signal handlers | both | Combine with cleanup hooks |
| P1 | stdin reading | waymark | Extend for @- convention |
| P2 | Spinner integration | waymark | stderr-based, quiet-aware |
| P2 | Custom help formatting | waymark | May not need for v1 |

---

## Next Steps

1. **Create core utilities**: Exit codes, output modes, TTY detection
2. **Build input parsing**: `collectIds()`, `expandFileArg()`, `parseGlob()`, `parseKeyValue()`
3. **Implement state persistence**: Cursor storage for `--next`/`--context`
4. **Integrate with @outfitter/ui**: Shape-to-output rendering
5. **Create typed Commander.js wrapper**: The `createCLI()`, `command()`, `output()` API
