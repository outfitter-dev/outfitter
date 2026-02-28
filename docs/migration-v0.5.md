# Migrating to v0.5

Breaking changes and new APIs in the v0.5 Builder Pattern + Agent-Navigable
Envelope release, with before/after code and migration steps for each change.

## 1. CommandBuilder `.input(schema)` — Schema-Driven Flag Derivation

The `CommandBuilder` now accepts a Zod object schema via `.input()` that
auto-derives Commander flags and provides validated, typed input to the handler.

**Before:**

```typescript
import { command } from "@outfitter/cli/command";

command("greet")
  .option("--name <value>", "User name")
  .option("--count <n>", "Repeat count")
  .action(async ({ flags }) => {
    const name = String(flags["name"] ?? "");
    const count = Number(flags["count"] ?? 1);
    // flags is untyped Record<string, unknown>
  })
  .build();
```

**After:**

```typescript
import { command } from "@outfitter/cli/command";
import { z } from "zod";

command("greet")
  .input(
    z.object({
      name: z.string().describe("User name"),
      count: z.number().default(1).describe("Repeat count"),
    })
  )
  .action(async ({ input }) => {
    // input is { name: string; count: number } — validated and typed
    console.log(input.name.repeat(input.count));
  })
  .build();
```

**Zod-to-Commander mapping (auto-derived):**

| Zod Type      | Commander Result        |
| ------------- | ----------------------- |
| `z.string()`  | String option           |
| `z.number()`  | Number option (coerced) |
| `z.boolean()` | Boolean flag            |
| `z.enum()`    | Choices option          |

- `.describe()` text becomes the option description
- `.default()` values become option defaults
- `.optional()` fields become optional flags

**Composing with explicit flags:** Explicit `.option()`, `.requiredOption()`,
and `.argument()` calls compose alongside `.input()` — they override or
supplement auto-derived flags for cases Zod can't express (positional args,
aliases, variadic params):

```typescript
command("deploy")
  .input(z.object({ env: z.string().describe("Target environment") }))
  .argument("<target>", "Deployment target")
  .option("-f, --force", "Skip confirmation")
  .action(async ({ args, input, flags }) => {
    // args[0] = target (from .argument())
    // input.env = validated string (from .input())
    // flags.force = boolean (from .option())
  })
  .build();
```

**Migration steps:**

1. Replace manual `.option()` declarations with a Zod schema in `.input()`
2. Change handler from `({ flags })` to `({ input })` for validated fields
3. Remove manual type coercion (`.input()` handles it via Zod)
4. Keep `.option()` / `.argument()` for positional args, aliases, and variadic
   params that Zod can't express

## 2. CommandBuilder `.context(factory)` — Typed Context Construction

The builder now supports `.context()` for constructing a typed context object
that is passed to the handler alongside input.

**Before:**

```typescript
command("deploy")
  .option("--env <value>", "Environment")
  .action(async ({ flags }) => {
    // Manual context construction inside the handler
    const config = await loadConfig(String(flags["env"]));
    const client = createClient(config);
    await client.deploy();
  })
  .build();
```

**After:**

```typescript
import { command } from "@outfitter/cli/command";
import { z } from "zod";

command("deploy")
  .input(z.object({ env: z.string().describe("Environment") }))
  .context(async (input) => ({
    config: await loadConfig(input.env),
    client: createClient(input.env),
  }))
  .action(async ({ input, ctx }) => {
    // ctx is typed: { config: Config; client: Client }
    await ctx.client.deploy(ctx.config);
  })
  .build();
```

The context factory:

- Runs after schema validation (if `.input()` is used), before the handler
- Receives the validated typed input (or raw parsed flags when `.input()` is not
  used)
- Errors are caught and produce proper exit codes (handler is not invoked)
- Works regardless of chain order (`.context()` before or after `.input()`)

**Migration steps:**

1. Extract setup/initialization code from handlers into `.context()` factories
2. Access the context object via `ctx` in the handler callback
3. Context factory errors are automatically caught — no need for try/catch

## 3. CommandBuilder `.hints(fn)` and `.onError(fn)` — Transport-Local Hints

Two new builder methods declare hint functions that are invoked at output time,
not during handler execution. Handlers remain transport-agnostic.

**Before:**

```typescript
// Hints were ad-hoc, coupled to the handler or output layer
command("deploy")
  .action(async ({ flags }) => {
    const result = await doDeploy(flags);
    // Manually construct hints in the handler or output code
  })
  .build();
```

**After:**

```typescript
import { command } from "@outfitter/cli/command";
import { z } from "zod";

command("deploy")
  .input(z.object({ env: z.string() }))
  .hints((result, input) => [
    {
      description: `Check deployment status for ${input.env}`,
      command: `deploy status --env ${input.env}`,
    },
  ])
  .onError((error, input) => [
    {
      description: "Retry with verbose logging",
      command: `deploy --env ${input.env} --verbose`,
    },
  ])
  .action(async ({ input }) => {
    // Handler is transport-agnostic — no hint logic here
  })
  .build();
```

**Types:**

```typescript
import type { SuccessHintFn, ErrorHintFn } from "@outfitter/cli/types";
import type { CLIHint } from "@outfitter/contracts";

// SuccessHintFn<TInput> = (result: unknown, input: TInput) => CLIHint[]
// ErrorHintFn<TInput>   = (error: unknown, input: TInput)  => CLIHint[]
```

**Migration steps:**

1. Move any hint construction logic out of handlers into `.hints()` / `.onError()`
2. Import `CLIHint` from `@outfitter/contracts` or `@outfitter/contracts/hints`
3. Hint functions are stored on the builder and invoked at output time — they
   do not affect handler behavior

## 4. Schema-Driven Presets via `createSchemaPreset()`

The `.preset()` method now accepts schema-driven presets (Zod schema fragments
with resolvers) in addition to the existing `FlagPreset`-based presets.

**Before:**

```typescript
import { createPreset } from "@outfitter/cli/flags";

const verbosityPreset = createPreset({
  id: "verbosity",
  options: [{ flags: "-v, --verbose", description: "Enable verbose output" }],
  resolve: (flags) => ({ verbose: Boolean(flags["verbose"]) }),
});

command("info").preset(verbosityPreset).action(/* ... */).build();
```

**After:**

```typescript
import { createSchemaPreset } from "@outfitter/cli/flags";
import { z } from "zod";

const verbosityPreset = createSchemaPreset({
  id: "verbosity",
  schema: z.object({
    verbose: z.boolean().default(false).describe("Enable verbose output"),
  }),
  resolve: (flags) => ({ verbose: Boolean(flags["verbose"]) }),
});

command("info")
  .input(z.object({ name: z.string() }))
  .preset(verbosityPreset)
  .action(async ({ input }) => {
    // Preset schema fields are merged into input validation
  })
  .build();
```

Schema presets auto-derive Commander flags from their Zod fragment (same
mapping as `.input()`) and merge their schema with `.input()` automatically.
Preset resolvers execute during command flow, composing resolved values into
the validated input.

**Existing `FlagPreset`-based presets continue to work unchanged.**

**New types:**

```typescript
import type { SchemaPreset, AnyPreset } from "@outfitter/cli/types";
import { createSchemaPreset, isSchemaPreset } from "@outfitter/cli/flags";
```

**Migration steps:**

1. Optionally replace `createPreset()` with `createSchemaPreset()` for presets
   that benefit from Zod schema fragments (auto-derived flags, type safety)
2. Existing `createPreset()` presets work unchanged — no migration required
3. The `.preset()` method now accepts `AnyPreset` (union of `FlagPreset` and
   `SchemaPreset`)

## 5. Response Envelope and `runHandler()` Lifecycle Bridge

New structured response envelope and a lifecycle bridge that automates the full
command execution flow.

### Envelope Structure

Commands can now wrap results in a structured envelope:

```json
{
  "ok": true,
  "command": "deploy",
  "result": { "status": "deployed" },
  "hints": [{ "description": "Check status", "command": "deploy status" }]
}
```

Error envelope:

```json
{
  "ok": false,
  "command": "deploy",
  "error": { "category": "validation", "message": "Missing --env flag" },
  "hints": [{ "description": "Specify env", "command": "deploy --env prod" }]
}
```

The `hints` field is **absent** (not an empty array) when there are no hints.

**Envelope construction helpers:**

```typescript
import {
  createSuccessEnvelope,
  createErrorEnvelope,
} from "@outfitter/cli/envelope";

const success = createSuccessEnvelope("deploy", { status: "ok" }, hints);
const error = createErrorEnvelope("deploy", "validation", "Bad input", hints);
```

### `runHandler()` Lifecycle Bridge

`runHandler()` automates the full lifecycle: context factory → handler
invocation → Result unwrap → envelope construction → output formatting →
exit code mapping.

**Before:**

```typescript
command("deploy")
  .action(async ({ flags }) => {
    const config = await loadConfig(String(flags["env"]));
    const result = await deployService(config);
    if (result.isOk()) {
      await output(result.value, resolvedMode);
    } else {
      exitWithError(result.error, resolvedMode);
    }
  })
  .build();
```

**After:**

```typescript
import { command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { z } from "zod";

command("deploy")
  .input(z.object({ env: z.string() }))
  .action(async ({ input }) => {
    await runHandler({
      command: "deploy",
      handler: async (input) => deployService(input),
      input,
      format: "json",
      contextFactory: async (input) => loadConfig(input.env),
      hints: (result, input) => [
        { description: "Check status", command: `status --env ${input.env}` },
      ],
      onError: (error, input) => [
        { description: "Retry", command: `deploy --env ${input.env} --force` },
      ],
    });
  })
  .build();
```

`runHandler()` respects `OUTFITTER_JSON` / `OUTFITTER_JSONL` environment
variables when the `format` parameter is omitted.

**Types:**

```typescript
import type {
  RunHandlerOptions,
  CommandEnvelope,
  SuccessEnvelope,
  ErrorEnvelope,
} from "@outfitter/cli/envelope";
```

**Migration steps:**

1. Import `runHandler` from `@outfitter/cli/envelope`
2. Replace manual Result unwrap → output → exit code logic with a single
   `runHandler()` call
3. Success produces `ok: true` with `result`; failure produces `ok: false` with
   `error.category` and `error.message`
4. Exit codes are automatically mapped from the error taxonomy

## 6. ErrorCategory Enrichment — JSON-RPC Codes and Retryable Flags

The error taxonomy in `@outfitter/contracts` now includes JSON-RPC codes (for
MCP protocol compliance) and retryable flags (for agent safety) alongside the
existing exit code and HTTP status mappings.

**Before:**

```typescript
import { exitCodeMap, statusCodeMap } from "@outfitter/contracts";

const exitCode = exitCodeMap["timeout"]; // 5
const httpStatus = statusCodeMap["timeout"]; // 504
```

**After:**

```typescript
import { errorCategoryMeta } from "@outfitter/contracts";

const meta = errorCategoryMeta("timeout");
// {
//   exitCode: 5,
//   statusCode: 504,
//   jsonRpcCode: -32001,
//   retryable: true,
// }
```

**New exports:**

```typescript
import {
  jsonRpcCodeMap, // Record<ErrorCategory, number>
  retryableMap, // Record<ErrorCategory, boolean>
  errorCategoryMeta, // (category: ErrorCategory) => ErrorCategoryMeta
} from "@outfitter/contracts";
```

**Full enrichment table:**

| Category     | Exit | HTTP | JSON-RPC | Retryable |
| ------------ | ---- | ---- | -------- | --------- |
| `validation` | 1    | 400  | -32602   | No        |
| `not_found`  | 2    | 404  | -32601   | No        |
| `conflict`   | 3    | 409  | -32002   | No        |
| `permission` | 4    | 403  | -32003   | No        |
| `timeout`    | 5    | 504  | -32001   | Yes       |
| `rate_limit` | 6    | 429  | -32004   | Yes       |
| `network`    | 7    | 502  | -32005   | Yes       |
| `internal`   | 8    | 500  | -32603   | No        |
| `auth`       | 9    | 401  | -32000   | No        |
| `cancelled`  | 130  | 499  | -32006   | No        |

**Existing `exitCodeMap` and `statusCodeMap` are unchanged.**

**Migration steps:**

1. Replace separate lookups of `exitCodeMap[cat]` / `statusCodeMap[cat]` with
   `errorCategoryMeta(cat)` for unified access
2. Use `meta.jsonRpcCode` in MCP transport adapters
3. Use `meta.retryable` to decide whether an agent should retry
4. Existing code using `exitCodeMap` / `statusCodeMap` directly continues to work

## 7. Hint Types — `ActionHint`, `CLIHint`, `MCPHint`

New canonical hint types for agent-navigable responses, exported from
`@outfitter/contracts`.

```typescript
import type { ActionHint, CLIHint, MCPHint } from "@outfitter/contracts";
// Also available from "@outfitter/contracts/hints"

// Base hint with description and optional params
const base: ActionHint = {
  description: "Retry with longer timeout",
  params: { timeoutMs: 10_000 },
};

// CLI-specific hint with runnable command
const cliHint: CLIHint = {
  description: "Fix lint issues",
  command: "outfitter lint --fix",
};

// MCP-specific hint with tool name and optional input
const mcpHint: MCPHint = {
  description: "Search for related notes",
  tool: "search-notes",
  input: { query: "architecture", limit: 5 },
};
```

These are types only — no runtime code. Use them to type hint arrays in
`.hints()`, `.onError()`, and `runHandler()` options.

**Migration steps:**

1. Import `CLIHint` from `@outfitter/contracts` for CLI hint arrays
2. Import `MCPHint` from `@outfitter/contracts` for MCP hint arrays
3. Replace any ad-hoc hint object shapes with these canonical types

## 8. Hint Generation Tiers

Three tiers of auto-generated hints are available from `@outfitter/cli/hints`:

```typescript
import {
  buildCommandTree,
  commandTreeHints,
  errorRecoveryHints,
  schemaHintParams,
} from "@outfitter/cli/hints";
```

**Tier 1 — Command tree introspection:**

```typescript
const tree = buildCommandTree(program);
const hints = commandTreeHints(tree);
// Auto-generated CLIHint[] from all registered commands
```

**Tier 2 — Error category recovery:**

```typescript
const hints = errorRecoveryHints("timeout", "my-cli");
// Standard recovery actions per error category
// e.g., [{ description: "Retry — timeout errors are often transient", command: "my-cli ..." }]
```

**Tier 3 — Schema-derived params:**

```typescript
const params = schemaHintParams(inputSchema);
// Extracts param metadata from Zod schema for hint construction
```

**Migration steps:**

1. Import hint generators from `@outfitter/cli/hints`
2. Replace hand-written hint arrays with generated hints where appropriate

## 9. Self-Documenting Root Command

When no subcommand is given, `createCLI()` now outputs the full command tree as
JSON (piped/JSON mode) or help text (TTY mode). The command tree includes all
registered commands with their descriptions and available options.

```bash
# TTY mode — displays standard help text
my-cli

# Piped/JSON mode — outputs structured command tree
my-cli | cat
my-cli --json
OUTFITTER_JSON=1 my-cli
```

The JSON output is a structured command tree object suitable for agent
consumption.

**Migration steps:**

No action required — this is additive behavior. If your CLI had a custom root
action, it continues to work. The self-documenting behavior only activates when
no subcommand is matched and no custom root action is defined.

## 10. `loadConfig()` Schema Parameter Is Now Optional

The `loadConfig()` function in `@outfitter/config` now accepts the schema
parameter as optional. Without a schema, it returns the raw parsed config
object as `Result<unknown, ...>`.

**Before:**

```typescript
import { loadConfig } from "@outfitter/config";

// Schema was required — no way to get raw config
const result = loadConfig("myapp", AppConfigSchema);
```

**After:**

```typescript
import { loadConfig } from "@outfitter/config";

// Without schema — returns raw parsed config
const raw = loadConfig("myapp");
// Result<unknown, NotFoundError | ParseError | CircularExtendsError>

// With options only — returns raw parsed config with custom search paths
const rawWithPaths = loadConfig("myapp", { searchPaths: ["/etc/myapp"] });

// With schema — returns validated typed config (unchanged)
const typed = loadConfig("myapp", AppConfigSchema);
// Result<T, NotFoundError | ValidationError | ParseError | CircularExtendsError>

// With schema and options — returns validated typed config (unchanged)
const full = loadConfig("myapp", AppConfigSchema, {
  searchPaths: ["/etc/myapp"],
});
```

**Overload signatures:**

```typescript
function loadConfig(appName: string): Result<unknown, ...>;
function loadConfig(appName: string, options: LoadConfigOptions): Result<unknown, ...>;
function loadConfig<T>(appName: string, schema: ZodSchema<T>): Result<T, ...>;
function loadConfig<T>(appName: string, schema: ZodSchema<T>, options: LoadConfigOptions): Result<T, ...>;
```

**Migration steps:**

1. Existing calls with schema continue to work unchanged
2. To get raw config without validation, call `loadConfig("myapp")` without a
   schema parameter
3. TypeScript overloads narrow the return type correctly — `Result<unknown, ...>`
   without schema, `Result<T, ...>` with schema

## 11. `defineResourceTemplate()` — Typed Resource Templates for MCP

`defineResourceTemplate()` in `@outfitter/mcp` now supports typed overloads
with Zod schema validation for URI template parameters.

**Before:**

```typescript
import { defineResourceTemplate } from "@outfitter/mcp";

const template = defineResourceTemplate({
  uriTemplate: "db:///users/{userId}/profile",
  name: "User Profile",
  handler: async (uri, variables) => {
    // variables is Record<string, string> — untyped
    const profile = await getProfile(variables.userId);
    return Result.ok([{ uri, text: JSON.stringify(profile) }]);
  },
});
```

**After:**

```typescript
import { defineResourceTemplate } from "@outfitter/mcp";
import { z } from "zod";

const template = defineResourceTemplate({
  uriTemplate: "db:///users/{userId}/posts/{postId}",
  name: "User Post",
  paramSchema: z.object({
    userId: z.string().min(1),
    postId: z.coerce.number().int().positive(),
  }),
  handler: async (uri, params, ctx) => {
    // params is { userId: string; postId: number } — validated and coerced
    const post = await getPost(params.userId, params.postId);
    return Result.ok([{ uri, text: JSON.stringify(post) }]);
  },
});
```

When `paramSchema` is provided, schema validation runs before handler
invocation — invalid parameters produce a `ValidationError` Result.

**The untyped `defineResourceTemplate()` overload without `paramSchema`
continues to work unchanged.**

Also available: `defineResource()` for static (non-template) resources:

```typescript
import { defineResource } from "@outfitter/mcp";

const resource = defineResource({
  uri: "file:///etc/app/config.json",
  name: "Application Config",
  mimeType: "application/json",
});
```

**Migration steps:**

1. Add `paramSchema` to `defineResourceTemplate()` calls to get typed,
   validated parameters
2. Update handler signature from `(uri, variables)` to `(uri, params, ctx)`
   when using `paramSchema`
3. Existing untyped definitions continue to work — migration is optional

## 12. Enhanced `testCommand()` and `testTool()` Test Helpers

The test helpers in `@outfitter/testing` now support the v0.5 builder pattern
features: schema validation, context injection, and hint assertion.

### `testCommand()`

**Before:**

```typescript
import { testCommand } from "@outfitter/testing";

const result = await testCommand(cli, ["greet", "--name", "World"], {
  env: { OUTFITTER_ENV: "test" },
});
// result: CliTestResult { stdout, stderr, exitCode }
```

**After:**

```typescript
import { testCommand } from "@outfitter/testing";

const result = await testCommand(cli, ["greet"], {
  input: { name: "World" }, // Converted to CLI args (--name World)
  context: { db: mockDb }, // Mock context object
  json: true, // Force JSON output for envelope parsing
  env: { OUTFITTER_ENV: "test" }, // Still supported
});

// result: TestCommandResult extends CliTestResult
expect(result.envelope?.ok).toBe(true);
expect(result.envelope?.result).toEqual({ greeting: "Hello, World!" });
```

**New options:**

| Option    | Type                      | Purpose                                  |
| --------- | ------------------------- | ---------------------------------------- |
| `input`   | `Record<string, unknown>` | Pre-parsed input (converted to CLI args) |
| `context` | `Record<string, unknown>` | Mock context object                      |
| `json`    | `boolean`                 | Force JSON output for envelope           |

**New return type:** `TestCommandResult` extends `CliTestResult` with:

| Field      | Type                           | Purpose                          |
| ---------- | ------------------------------ | -------------------------------- |
| `envelope` | `CommandEnvelope \| undefined` | Parsed envelope from JSON output |

### `testTool()`

**Before:**

```typescript
import { testTool } from "@outfitter/testing";

const result = await testTool(myTool, input, {
  cwd: "/tmp/test",
  requestId: "req-1",
});
// result: Result<TOutput, TError | ValidationError>
```

**After:**

```typescript
import { testTool } from "@outfitter/testing";

const result = await testTool(myTool, input, {
  context: {
    cwd: "/tmp/test",
    requestId: "req-1",
    logger: testLogger,
  },
  hints: (result) => [{ description: "Next step", tool: "other-tool" }],
});

// result: TestToolResult<TOutput, TError>
expect(result.hints).toHaveLength(1);
```

**New options:**

| Option    | Type                             | Purpose                     |
| --------- | -------------------------------- | --------------------------- |
| `context` | `Partial<HandlerContext>`        | Full context injection      |
| `hints`   | `(result: unknown) => MCPHint[]` | Hint function for assertion |

The `cwd`, `env`, and `requestId` options are deprecated — use `context`
instead.

**New return type:** `TestToolResult<TOutput, TError>` extends `Result` with:

| Field   | Type                     | Purpose                       |
| ------- | ------------------------ | ----------------------------- |
| `hints` | `MCPHint[] \| undefined` | Generated hints for assertion |

**Migration steps:**

1. Replace `{ cwd, env, requestId }` with `{ context: { cwd, env, requestId } }`
   in `testTool()` calls
2. Use `input` option in `testCommand()` to pass pre-parsed input instead of
   constructing CLI args manually
3. Use `json: true` and check `result.envelope` for envelope assertions
4. Existing test code continues to work — deprecated options still function

## New Additions (Non-Breaking)

v0.5 also adds several new features that require no migration.

### `outfitter check action-registry` — Registry Completeness Scanner

Automated scanner that cross-references command files against the action
registry:

```bash
outfitter check action-registry --cwd .
```

Reports unregistered commands with file paths. Exit code 0 if all commands are
registered, non-zero if gaps are found.

### `outfitter upgrade` — Commander-to-Builder Codemod

Automated codemod that detects `.command().action()` patterns and transforms
them to `.input(schema).action()`:

```bash
outfitter upgrade --cwd . --codemods
```

Generates Zod schema skeletons from existing `.option()` / `.argument()`
declarations. Commands too complex for automatic transformation are left as-is.

### `outfitter init --example` — Pattern-Rich Scaffolding

```bash
outfitter init cli my-tool --example todo
outfitter init mcp my-server --example files
```

Scaffolds with real v0.5 patterns (builder, context, hints, `runHandler`)
instead of hello-world stubs.

## Upgrade Checklist

- [ ] Replace manual `.option()` declarations with `.input()` Zod schemas where
      appropriate
- [ ] Extract handler setup code into `.context()` factories
- [ ] Move hint logic from handlers to `.hints()` / `.onError()` builder methods
- [ ] Optionally adopt `createSchemaPreset()` for schema-driven presets
- [ ] Adopt `runHandler()` for new commands to automate the output lifecycle
- [ ] Use `errorCategoryMeta()` instead of separate `exitCodeMap` /
      `statusCodeMap` lookups
- [ ] Import `CLIHint` / `MCPHint` from `@outfitter/contracts` for typed hints
- [ ] Update `testCommand()` calls to use `input`, `context`, and `json` options
- [ ] Update `testTool()` calls to use `context` instead of deprecated
      `cwd` / `env` / `requestId`
- [ ] Run `bun run typecheck` to catch remaining type errors
- [ ] Run `bun run test` to verify behavior
