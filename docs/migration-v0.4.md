# Migrating to v0.4

Breaking changes in the v0.4 Foundation release and how to update your code.

## 1. `--json` Flag Default Changed to `undefined`

The global `--json` flag registered by `createCLI()` now defaults to `undefined`
instead of `false`. This lets downstream code distinguish "not passed" from
"explicitly disabled."

**Before:**

```typescript
// options.json was always boolean
const opts = command.optsWithGlobals();
if (opts.json) {
  // --json passed
}
// opts.json === false when flag not passed
```

**After:**

```typescript
// options.json is boolean | undefined
const opts = command.optsWithGlobals();
if (opts.json === true) {
  // --json explicitly passed
}
// opts.json === undefined when flag not passed
```

**Migration steps:**

1. Replace truthiness checks (`if (opts.json)`) with strict equality
   (`if (opts.json === true)`)
2. Update any code that relied on `opts.json === false` to check for
   `opts.json === undefined` instead
3. The `preAction` env bridge now only sets `OUTFITTER_JSON=1` when the flag is
   explicitly `true`, and leaves the env var untouched when the flag is omitted

## 2. Commander Is Now a Peer Dependency of `@outfitter/cli`

`commander` moved from `dependencies` to `peerDependencies` in
`@outfitter/cli`. You must install it yourself.

**Before:**

```json
{
  "dependencies": {
    "@outfitter/cli": "^0.3.0"
  }
}
```

Commander was bundled — no explicit install needed.

**After:**

```json
{
  "dependencies": {
    "@outfitter/cli": "^0.4.0",
    "commander": "^14.0.0"
  }
}
```

**Migration steps:**

1. Add `commander` (version `>=14.0.0`) to your project's `dependencies`
2. Run `bun install` (or your package manager's install command)
3. No code changes needed — imports remain the same

## 3. `output()` Signature Changed — Format Is Now a Positional Parameter

The `output()` and `exitWithError()` functions accept an explicit `format`
parameter instead of reading `mode` from the options object.

### `output()`

**Before:**

```typescript
import { output } from "@outfitter/cli";

output(data);
output(data, { mode: "json" });
output(data, { mode: "json", pretty: true });
output(data, { stream: process.stderr });
```

**After:**

```typescript
import { output } from "@outfitter/cli";

output(data);
output(data, "json");
output(data, "json", { pretty: true });
output(data, undefined, { stream: process.stderr });
```

### `exitWithError()`

**Before:**

```typescript
import { exitWithError } from "@outfitter/cli";

exitWithError(error);
exitWithError(error, { mode: "json" });
```

**After:**

```typescript
import { exitWithError } from "@outfitter/cli";

exitWithError(error);
exitWithError(error, "json");
```

**Detection hierarchy** (highest wins):

1. Explicit `format` parameter
2. Environment variables (`OUTFITTER_JSON`, `OUTFITTER_JSONL`)
3. Default: `"human"`

**Migration steps:**

1. Replace `output(data, { mode: "json" })` with `output(data, "json")`
2. Replace `output(data, { mode: "json", pretty: true })` with
   `output(data, "json", { pretty: true })`
3. For `exitWithError`, replace `exitWithError(err, { mode })` with
   `exitWithError(err, mode)`
4. The `mode` field was removed from `OutputOptions` — if you referenced it
   directly, move to the positional `format` parameter

## 4. Output-Mode Resolution Centralized in `resolveOutputMode()`

Output-mode resolution logic is now centralized in a single function exported
from `@outfitter/cli/query`. The following helpers were removed:

- `resolveOutputModeWithEnvFallback()` — deleted from
  `apps/outfitter/src/actions/shared.ts`
- `hasExplicitOutputFlag()` — deleted from
  `apps/outfitter/src/actions/shared.ts`
- `resolveDocsOutputMode()` — file
  `apps/outfitter/src/actions/docs-output-mode.ts` deleted entirely

**Before:**

```typescript
import {
  hasExplicitOutputFlag,
  resolveOutputModeWithEnvFallback,
} from "./shared.js";

const outputMode = resolveOutputModeWithEnvFallback(
  context.flags,
  presetOutputMode ?? "human",
  { forceHumanWhenImplicit: true }
);
```

**After:**

```typescript
import { resolveOutputMode } from "@outfitter/cli/query";

const { mode, source } = resolveOutputMode(context.flags, {
  forceHumanWhenImplicit: true,
});
// mode: "human" | "json" | "jsonl"
// source: "flag" | "env" | "default"
```

The new resolver returns both the resolved mode **and** its source, so callers
can make decisions based on how the mode was determined without re-implementing
detection logic.

**Resolution order** (highest wins):

1. Explicit `--output` / `-o` flag (source: `"flag"`)
2. Legacy `--json` / `--jsonl` boolean flags (source: `"flag"`)
3. `OUTFITTER_JSONL=1` / `OUTFITTER_JSON=1` env vars (source: `"env"`)
4. Configured default — typically `"human"` (source: `"default"`)

**Migration steps:**

1. Replace all calls to `resolveOutputModeWithEnvFallback()` with
   `resolveOutputMode()` from `@outfitter/cli/query`
2. Replace calls to `resolveDocsOutputMode()` with `resolveOutputMode()`
3. Remove imports of `hasExplicitOutputFlag` — explicitness is now tracked
   automatically via the `source` field
4. Destructure `{ mode, source }` from the return value instead of receiving a
   plain string

## 5. `resolvePresetDependencyVersions()` Returns `Result` Instead of Throwing

The dependency-version resolver in `apps/outfitter/src/engine/dependency-versions.ts`
now returns `Result<ResolvedPresetDependencyVersions, InternalError>` instead of
throwing on failure.

**Before:**

```typescript
import { resolvePresetDependencyVersions } from "../engine/dependency-versions.js";

try {
  const versions = resolvePresetDependencyVersions();
  const dep = versions.internal["@outfitter/cli"];
} catch (error) {
  console.error("Failed:", error.message);
}
```

**After:**

```typescript
import { resolvePresetDependencyVersions } from "../engine/dependency-versions.js";

const result = resolvePresetDependencyVersions();
if (result.isErr()) {
  // result.error is InternalError
  console.error("Failed:", result.error.message);
  return;
}
const dep = result.value.internal["@outfitter/cli"];
```

**Migration steps:**

1. Remove try/catch around `resolvePresetDependencyVersions()` calls
2. Check `result.isErr()` / `result.isOk()` on the returned `Result`
3. Access resolved versions via `result.value` instead of using the return value
   directly
4. `clearResolvedVersionsCache()` is unchanged — it still invalidates the cache
5. Successful results are cached as before; failures are **not** cached, allowing
   retry

## New Utilities (Non-Breaking)

v0.4 also adds several new utilities. These are additive and require no
migration, but are worth knowing about.

### `parseInput()` — Zod-to-Result validation

```typescript
import { parseInput } from "@outfitter/contracts";
import { z } from "zod";

const schema = z.object({ name: z.string(), age: z.number() });
const result = parseInput(schema, data);
// Result<{ name: string; age: number }, ValidationError>
```

### `wrapError()` — Typed error normalization

```typescript
import { wrapError } from "@outfitter/contracts";

// Typed OutfitterErrors pass through unchanged
wrapError(typedError); // same reference

// Unknown errors wrapped as InternalError (or via custom mapper)
wrapError(unknownError); // InternalError
wrapError(unknownError, (err) =>
  err instanceof MyError ? NotFoundError.create("resource", "id") : undefined
);
```

### `fromFetch()` — HTTP status-to-Result

```typescript
import { fromFetch } from "@outfitter/contracts";

const result = fromFetch(response);
// 2xx → Ok<Response>
// 404 → Err<NotFoundError>, 401 → Err<AuthError>, etc.
```

### `expectOk()` / `expectErr()` — Test assertion helpers

```typescript
import { expectOk, expectErr } from "@outfitter/contracts/assert";

const value = expectOk(result); // asserts Ok, returns T
const error = expectErr(result); // asserts Err, returns E
```

### `testCommand()` / `testTool()` — Wiring test helpers

```typescript
import { testCommand, testTool } from "@outfitter/testing";

const { stdout, stderr, exitCode } = await testCommand(cli, [
  "check",
  "--json",
]);
const toolResult = await testTool(myTool, { input: "value" });
```

## Upgrade Checklist

- [ ] Install `commander` as a direct dependency (`>=14.0.0`)
- [ ] Update `--json` flag checks from truthiness to `=== true`
- [ ] Migrate `output(data, { mode })` calls to `output(data, format)`
- [ ] Migrate `exitWithError(err, { mode })` calls to `exitWithError(err, format)`
- [ ] Replace `resolveOutputModeWithEnvFallback()` with `resolveOutputMode()`
- [ ] Replace `resolveDocsOutputMode()` with `resolveOutputMode()`
- [ ] Remove `hasExplicitOutputFlag` imports (use `source` field instead)
- [ ] Handle `Result` from `resolvePresetDependencyVersions()` instead of
      try/catch
- [ ] Run `bun run typecheck` to catch remaining type errors
- [ ] Run `bun run test` to verify behavior
