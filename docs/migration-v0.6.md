# Migrating to v0.6

Breaking changes and new APIs in the v0.6 Streaming, Safety, Completeness
release, with before/after code and migration steps for each change.

## 1. NDJSON Streaming Protocol and `ctx.progress`

Handlers can now emit real-time progress events via a transport-agnostic
`ctx.progress` callback. The CLI adapter writes events as NDJSON lines; the MCP
adapter translates them to `notifications/progress`.

### Streaming Types (`@outfitter/contracts/stream`)

Three event types form the streaming protocol:

```typescript
import type {
  StreamEvent,
  StreamStartEvent,
  StreamStepEvent,
  StreamProgressEvent,
  ProgressCallback,
} from "@outfitter/contracts/stream";
```

| Event Type            | Discriminator | Fields                           |
| --------------------- | ------------- | -------------------------------- |
| `StreamStartEvent`    | `"start"`     | `command`, `ts` (ISO-8601)       |
| `StreamStepEvent`     | `"step"`      | `name`, `status`, `duration_ms?` |
| `StreamProgressEvent` | `"progress"`  | `current`, `total`, `message?`   |

### `HandlerContext.progress`

`ctx.progress` is an optional `ProgressCallback` on `HandlerContext`. When a
transport adapter enables streaming, it provides the callback. When streaming is
not active, `ctx.progress` is `undefined` — the handler simply returns its
final result.

**Before (v0.5):**

```typescript
import type { HandlerContext, Handler } from "@outfitter/contracts";

const handler: Handler<Input, Output> = async (input, ctx) => {
  // No progress reporting — handler returns final result only
  const result = await doWork(input);
  return Result.ok(result);
};
```

**After (v0.6):**

```typescript
import type { HandlerContext, Handler } from "@outfitter/contracts";

const handler: Handler<Input, Output> = async (input, ctx) => {
  ctx.progress?.({
    type: "start",
    command: "process",
    ts: new Date().toISOString(),
  });

  for (let i = 0; i < items.length; i++) {
    await processItem(items[i]);
    ctx.progress?.({ type: "progress", current: i + 1, total: items.length });
  }

  ctx.progress?.({
    type: "step",
    name: "cleanup",
    status: "complete",
    duration_ms: 42,
  });

  return Result.ok({ processed: items.length });
};
```

Use optional chaining (`ctx.progress?.()`) so the handler works regardless of
whether streaming is active. The handler remains transport-agnostic — it
doesn't know whether events go to NDJSON stdout or MCP notifications.

**Migration steps:**

1. Add `ctx.progress?.()` calls to handlers that benefit from real-time
   progress reporting
2. Use optional chaining — `ctx.progress` is `undefined` when streaming is
   not active
3. Import streaming types from `@outfitter/contracts/stream` if you need to
   type event objects explicitly

## 2. `--stream` Flag

The CLI adapter supports a `--stream` flag that enables NDJSON streaming mode.
When active, progress events and the terminal envelope are written as
newline-delimited JSON to stdout.

### NDJSON Protocol

Each line is a self-contained JSON object with a `type` discriminator:

```
{"type":"start","command":"check","ts":"2024-01-01T00:00:00.000Z"}
{"type":"progress","current":5,"total":10,"message":"Processing..."}
{"type":"step","name":"scan","status":"complete","duration_ms":42}
{"ok":true,"command":"check","result":{"files":10},"hints":[...]}
```

**Event ordering is deterministic:**

1. `start` event is always first
2. `step` / `progress` events appear in handler emission order
3. Terminal envelope (success or error) is always last
4. No events appear after the envelope

### Enabling Streaming in `runHandler()`

**Before (v0.5):**

```typescript
import { runHandler } from "@outfitter/cli/envelope";

await runHandler({
  command: "check",
  handler: checkHandler,
  input,
  format: outputMode,
});
```

**After (v0.6):**

```typescript
import { runHandler } from "@outfitter/cli/envelope";

await runHandler({
  command: "check",
  handler: checkHandler,
  input,
  format: outputMode,
  stream: Boolean(flags.stream), // new — enables NDJSON streaming
});
```

When `stream: true`, `runHandler()`:

1. Writes a `start` event as the first NDJSON line
2. Creates a `ProgressCallback` and injects it into the handler context
3. Writes the terminal envelope (success or error) as the last NDJSON line

`--stream` is **orthogonal to output mode** — it controls delivery (streaming
vs batch), not serialization (JSON vs human). You can combine `--stream` with
`--output json`, `--output human`, or env-driven mode resolution.

### Stream Adapter Internals

The CLI NDJSON adapter lives in `@outfitter/cli/streaming`:

```typescript
import {
  writeNdjsonLine,
  writeStreamEnvelope,
  createNdjsonProgress,
} from "@outfitter/cli/streaming";
```

In most cases you won't need these directly — `runHandler()` handles the
wiring. They're useful for custom streaming setups or testing.

**Migration steps:**

1. Add `stream: Boolean(flags.stream)` to `runHandler()` calls
2. Add `ctx.progress?.()` calls in handlers that benefit from progress
   reporting (see section 1)
3. No changes needed for non-streaming commands — `stream` defaults to `false`

## 3. `.destructive()` and `--dry-run` Pattern

Commands that modify or delete data can now be marked as destructive. The
builder auto-adds a `--dry-run` flag and `runHandler()` auto-generates a hint
to execute without `--dry-run` (preview-then-commit pattern).

**Before (v0.5):**

```typescript
import { command } from "@outfitter/cli/command";

command("delete")
  .description("Delete resources")
  .option("--dry-run", "Preview without deleting", false) // manual flag
  .action(async ({ flags }) => {
    const isDryRun = Boolean(flags["dryRun"]);
    // Manual dry-run logic...
  })
  .build();
```

**After (v0.6):**

```typescript
import { command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";

command("delete")
  .description("Delete resources")
  .destructive(true) // auto-adds --dry-run flag
  .action(async ({ flags }) => {
    const isDryRun = Boolean(flags["dryRun"]);
    await runHandler({
      command: "delete",
      handler: async (input) =>
        isDryRun
          ? Result.ok({ preview: true, count: 5 })
          : deleteResources(input),
      dryRun: isDryRun, // generates "Execute without dry-run" hint
    });
  })
  .build();
```

**What `.destructive(true)` does:**

- Auto-adds `--dry-run` flag (deduplicated if already present from `.option()`,
  `.preset()`, or `.input()`)
- Default behavior (no `.destructive()` call) is non-destructive

**What `runHandler({ dryRun: true })` does:**

- Appends a `CLIHint` to the success envelope: `"Execute without dry-run"` with
  the command stripped of `--dry-run`
- The handler is responsible for checking the dry-run flag and performing
  preview-only logic

**Dry-run envelope example:**

```json
{
  "ok": true,
  "command": "delete",
  "result": { "preview": true, "count": 5 },
  "hints": [
    { "description": "Execute without dry-run", "command": "delete --id abc" }
  ]
}
```

**Migration steps:**

1. Replace manual `--dry-run` option declarations with `.destructive(true)`
2. Pass `dryRun: Boolean(flags.dryRun)` to `runHandler()` for automatic hint
   generation
3. Keep the handler's dry-run branch logic — the builder only handles flag
   declaration and hint generation

## 4. `readOnly` / `idempotent` Metadata and MCP Annotations

Commands can now declare safety metadata signals that are surfaced in the
self-documenting command tree and mapped to MCP tool annotations.

**Before (v0.5):**

```typescript
// No way to declare read-only or idempotent semantics
command("list")
  .description("List all resources")
  .action(async ({ flags }) => {
    /* ... */
  })
  .build();
```

**After (v0.6):**

```typescript
command("list")
  .description("List all resources")
  .readOnly(true)
  .action(async ({ flags }) => {
    /* ... */
  })
  .build();

command("set")
  .description("Set a configuration value")
  .idempotent(true)
  .action(async ({ flags }) => {
    /* ... */
  })
  .build();
```

### Where Metadata Appears

**Self-documenting command tree (JSON mode):**

```json
{
  "name": "list",
  "description": "List all resources",
  "metadata": { "readOnly": true }
}
```

The `metadata` field is only present when `readOnly` or `idempotent` is set.

**MCP tool annotations:**

When tools are registered in `@outfitter/mcp`, `readOnly` maps to
`readOnlyHint` and `idempotent` maps to `idempotentHint` in the MCP
`ToolAnnotations` type:

```typescript
import { defineTool } from "@outfitter/mcp";

const listTool = defineTool({
  name: "list",
  description: "List resources",
  inputSchema: z.object({}),
  annotations: {
    readOnlyHint: true, // maps from readOnly
  },
  handler: listHandler,
});
```

```typescript
import type { ToolAnnotations } from "@outfitter/mcp";
// { readOnlyHint?: boolean; idempotentHint?: boolean; ... }
```

**Migration steps:**

1. Add `.readOnly(true)` to query/list commands that don't modify state
2. Add `.idempotent(true)` to set/upsert commands with PUT-like semantics
3. Set `annotations.readOnlyHint` / `annotations.idempotentHint` on MCP tool
   definitions where applicable
4. No changes needed for commands that are neither read-only nor idempotent —
   the default is both `false`

## 5. `retryable` / `retry_after` in Error Envelopes

Error envelopes now include `retryable` (derived from the error category) and
`retry_after` (from `RateLimitError.retryAfterSeconds`) fields. Agents can use
these to decide whether to retry and how long to wait.

**Before (v0.5):**

```json
{
  "ok": false,
  "command": "fetch",
  "error": {
    "category": "rate_limit",
    "message": "Too many requests"
  }
}
```

Agents had to look up retryability from the error category themselves.

**After (v0.6):**

```json
{
  "ok": false,
  "command": "fetch",
  "error": {
    "category": "rate_limit",
    "message": "Too many requests",
    "retryable": true,
    "retry_after": 60
  }
}
```

### How It Works

`createErrorEnvelope()` now accepts an optional `retryAfterSeconds` parameter
and automatically derives `retryable` from `errorCategoryMeta()`:

```typescript
import { createErrorEnvelope } from "@outfitter/cli/envelope";

// Non-retryable error (retryable derived from category)
const validationEnvelope = createErrorEnvelope(
  "deploy",
  "validation",
  "Missing env flag"
);
// error.retryable === false, no retry_after

// Retryable rate-limit error with delay
const rateLimitEnvelope = createErrorEnvelope(
  "fetch",
  "rate_limit",
  "Too many requests",
  undefined, // hints
  60 // retryAfterSeconds
);
// error.retryable === true, error.retry_after === 60
```

`runHandler()` extracts `retryAfterSeconds` from `RateLimitError` instances
automatically — no extra wiring needed:

```typescript
import { RateLimitError } from "@outfitter/contracts";

const handler = async () => {
  return Result.err(
    RateLimitError.create("Too many requests", 60) // retryAfterSeconds: 60
  );
};
// Error envelope will include retryable: true, retry_after: 60
```

**Retryability by category:**

| Category     | `retryable` | Notes                                 |
| ------------ | ----------- | ------------------------------------- |
| `timeout`    | `true`      | Transient — may succeed on retry      |
| `rate_limit` | `true`      | Includes `retry_after` when available |
| `network`    | `true`      | Transient — connection may recover    |
| `validation` | `false`     | Permanent — fix input first           |
| `not_found`  | `false`     | Permanent — resource doesn't exist    |
| `conflict`   | `false`     | Requires conflict resolution          |
| `permission` | `false`     | Requires access grant                 |
| `internal`   | `false`     | Bug — report, don't retry             |
| `auth`       | `false`     | Re-authenticate first                 |
| `cancelled`  | `false`     | User-initiated cancellation           |

**Updated `ErrorEnvelope` type:**

```typescript
import type { ErrorEnvelope } from "@outfitter/cli/envelope";

// ErrorEnvelope.error now includes:
// {
//   category: ErrorCategory;
//   message: string;
//   retryable: boolean;       // new in v0.6
//   retry_after?: number;     // new in v0.6 (seconds, rate_limit only)
// }
```

**Migration steps:**

1. No action required — `retryable` is automatically included in all error
   envelopes produced by `runHandler()` and `createErrorEnvelope()`
2. Agent code consuming error envelopes can now check `error.retryable` instead
   of maintaining a separate category-to-retryability mapping
3. For rate-limit errors, check `error.retry_after` for the recommended wait
   time in seconds

## 6. Output Truncation and Pagination Hints

Array output can now be truncated when a `limit` option is configured. Truncated
responses include metadata and pagination hints for continuation.

**New module:** `@outfitter/cli/truncation`

```typescript
import {
  truncateOutput,
  type TruncationOptions,
  type TruncationResult,
  type TruncationMetadata,
  DEFAULT_FILE_POINTER_THRESHOLD,
} from "@outfitter/cli/truncation";
```

### Basic Usage

```typescript
import { truncateOutput } from "@outfitter/cli/truncation";

// No truncation (limit not set)
const pass = truncateOutput(items, {});
// pass.data === items, pass.metadata === undefined

// Truncate to 20 items
const truncated = truncateOutput(items, {
  limit: 20,
  commandName: "list",
});
// truncated.data.length === 20
// truncated.metadata === { showing: 20, total: 100, truncated: true }
// truncated.hints includes pagination continuation

// With offset (page 2)
const page2 = truncateOutput(items, {
  limit: 20,
  offset: 20,
  commandName: "list",
});
```

### Truncation Metadata

When output exceeds the configured limit, the result includes structured
metadata:

```typescript
interface TruncationMetadata {
  showing: number; // items in truncated output
  total: number; // items before truncation
  truncated: true; // always true when metadata present
  full_output?: string; // file pointer path (see section 7)
}
```

### Pagination Hints

Truncated responses include `CLIHint`(s) for continuing:

```json
{
  "description": "Show next 20 of 80 remaining items",
  "command": "list --offset 20 --limit 20"
}
```

Agents can execute these hints directly to page through results.

**Migration steps:**

1. Import `truncateOutput` from `@outfitter/cli/truncation`
2. Apply truncation to array output before passing to `output()` or envelope
   construction
3. Include `truncated.metadata` and `truncated.hints` in the response
4. No changes needed for commands that don't use truncation — `limit: undefined`
   passes through untouched

## 7. File Pointers for Large Output

When output is very large (exceeding the file pointer threshold), the full
result is written to a temp file and a file pointer is included in the
truncation metadata.

```typescript
import {
  truncateOutput,
  DEFAULT_FILE_POINTER_THRESHOLD,
} from "@outfitter/cli/truncation";

const result = truncateOutput(largeArray, {
  limit: 50,
  commandName: "search",
  filePointerThreshold: 1000, // default is DEFAULT_FILE_POINTER_THRESHOLD (1000)
});

// When total > filePointerThreshold:
// result.metadata.full_output === "/tmp/outfitter-output-<timestamp>-<random>.json"
```

**Truncation metadata with file pointer:**

```json
{
  "showing": 50,
  "total": 5000,
  "truncated": true,
  "full_output": "/tmp/outfitter-output-1706745600000-abc123.json"
}
```

### Graceful Degradation

If the file write fails (permissions, disk full, etc.), the command still
returns truncated output with a warning hint instead of crashing:

```json
{
  "description": "Warning: Could not write full output to file (EACCES: permission denied)",
  "command": "search --limit 5000"
}
```

**Options:**

```typescript
interface TruncationOptions {
  limit?: number; // max items in output (undefined = no truncation)
  offset?: number; // pagination offset (default: 0)
  commandName?: string; // used in pagination hint commands
  filePointerThreshold?: number; // threshold for file pointer (default: 1000)
  tempDir?: string; // custom temp directory (default: os.tmpdir())
}
```

**Migration steps:**

1. File pointers are automatic when using `truncateOutput()` — no extra code
   needed
2. The default threshold is 1000 items; override with `filePointerThreshold` if
   needed
3. Agents consuming responses can read `metadata.full_output` to access the
   complete result file

## 8. `.relatedTo()` and Tier-4 Hints (Action Graph)

Commands can now declare relationships to other commands via `.relatedTo()`.
These declarations build a navigable action graph that generates tier-4 hints
in response envelopes — success hints for next-actions and error hints for
remediation paths.

**Before (v0.5):**

```typescript
// Tiers 1-3 only — no inter-command relationship awareness
command("deploy")
  .description("Deploy application")
  .hints((result, input) => [
    // Manually maintained hint list
    { description: "Check status", command: `status --env ${input.env}` },
  ])
  .build();
```

**After (v0.6):**

```typescript
command("deploy")
  .description("Deploy application")
  .relatedTo("status", { description: "Check deployment status" })
  .relatedTo("rollback", { description: "Rollback if needed" })
  .action(async ({ flags }) => {
    /* ... */
  })
  .build();

command("status")
  .description("Check deployment status")
  .relatedTo("deploy", { description: "Redeploy" })
  .build();

command("rollback")
  .description("Rollback deployment")
  .relatedTo("deploy", { description: "Redeploy after rollback" })
  .build();
```

### Action Graph

The `.relatedTo()` declarations build a graph with commands as nodes and
relationships as edges:

```typescript
import { buildActionGraph } from "@outfitter/cli/hints";
import type { ActionGraph, ActionGraphEdge } from "@outfitter/cli/hints";

const graph = buildActionGraph(program);
// graph.nodes: ["deploy", "status", "rollback"]
// graph.edges: [
//   { from: "deploy", to: "status", description: "Check deployment status" },
//   { from: "deploy", to: "rollback", description: "Rollback if needed" },
//   { from: "status", to: "deploy", description: "Redeploy" },
//   { from: "rollback", to: "deploy", description: "Redeploy after rollback" },
// ]
```

### Tier-4 Hint Generation

Two new hint generators produce tier-4 hints from graph edges:

```typescript
import { graphSuccessHints, graphErrorHints } from "@outfitter/cli/hints";

// Success: suggest next actions from graph neighbors
const nextHints = graphSuccessHints(graph, "deploy", "my-cli");
// [
//   { description: "Check deployment status", command: "my-cli status" },
//   { description: "Rollback if needed", command: "my-cli rollback" },
// ]

// Error: suggest remediation paths from graph neighbors
const fixHints = graphErrorHints(graph, "deploy", "my-cli");
// [
//   { description: "Try: Check deployment status", command: "my-cli status" },
//   { description: "Try: Rollback if needed", command: "my-cli rollback" },
// ]
```

Self-links are excluded from hint generation (they would be confusing as
"next action" suggestions).

### Hint Tiers Summary

| Tier | Source         | Generator                                   | Description                 |
| ---- | -------------- | ------------------------------------------- | --------------------------- |
| 1    | Command tree   | `commandTreeHints()`                        | "What can I do?"            |
| 2    | Error category | `errorRecoveryHints()`                      | Standard recovery actions   |
| 3    | Zod schema     | `schemaHintParams()`                        | Parameter shapes for agents |
| 4    | Action graph   | `graphSuccessHints()` / `graphErrorHints()` | Related commands            |

### Edge Case Handling

- **Unknown targets:** Produce a warning in `graph.warnings` (not a crash).
  The edge is still added to the graph.
- **Self-links:** Preserved in the graph but excluded from hint generation.
- **Cycles:** Do not cause infinite loops — graph traversal is single-hop
  (direct neighbors only).

**Migration steps:**

1. Add `.relatedTo(target, { description })` declarations to commands that have
   logical relationships (deploy → status, create → list, etc.)
2. Use `buildActionGraph(program)` to construct the graph from registered
   commands
3. Use `graphSuccessHints()` / `graphErrorHints()` in `.hints()` / `.onError()`
   callbacks or compose them with `runHandler()` hint functions
4. Multiple `.relatedTo()` calls accumulate — each declares a separate edge

## 9. MCP Progress Adapter

The MCP adapter translates `ctx.progress` events to `notifications/progress`
via the MCP SDK. This is automatic — when an MCP client provides a
`progressToken`, the server creates a progress callback and injects it into the
handler context.

**Module:** `@outfitter/mcp/progress`

```typescript
import {
  createMcpProgressCallback,
  type McpProgressNotification,
  type McpNotificationSender,
} from "@outfitter/mcp/progress";
```

### How It Works

1. MCP client sends a tool call with `progressToken` in the request params
2. `createMcpServer()` detects the token and calls `createMcpProgressCallback()`
3. The callback is injected as `ctx.progress` in the handler context
4. Each `ctx.progress()` call emits a `notifications/progress` notification

**Event mapping:**

| `StreamEvent.type` | MCP `progress` | MCP `total` | MCP `message`             |
| ------------------ | -------------- | ----------- | ------------------------- |
| `start`            | `0`            | —           | `[start] {command}`       |
| `step`             | `0`            | —           | `[step] {name}: {status}` |
| `progress`         | `current`      | `total`     | `message` (if provided)   |

Without a `progressToken`, `ctx.progress` is `undefined` and no notifications
are sent. The handler is unaffected.

**Migration steps:**

1. No changes needed for existing MCP tools — progress support is automatic
   when the client provides a `progressToken`
2. Add `ctx.progress?.()` calls to tool handlers for real-time progress
   reporting (same as CLI handlers — see section 1)

## Upgrade Checklist

- [ ] Add `ctx.progress?.()` calls to handlers that benefit from streaming
- [ ] Pass `stream: Boolean(flags.stream)` to `runHandler()` calls
- [ ] Replace manual `--dry-run` flag declarations with `.destructive(true)`
- [ ] Pass `dryRun: Boolean(flags.dryRun)` to `runHandler()` for dry-run
      hint generation
- [ ] Add `.readOnly(true)` to query commands, `.idempotent(true)` to
      upsert commands
- [ ] Set `readOnlyHint` / `idempotentHint` on MCP tool annotations
- [ ] Agent code: check `error.retryable` and `error.retry_after` in error
      envelopes
- [ ] Apply `truncateOutput()` from `@outfitter/cli/truncation` to array
      output where pagination is needed
- [ ] Add `.relatedTo()` declarations for inter-command relationships
- [ ] Use `graphSuccessHints()` / `graphErrorHints()` for tier-4 hints
- [ ] Run `bun run typecheck` to catch type errors
- [ ] Run `bun run test` to verify behavior
