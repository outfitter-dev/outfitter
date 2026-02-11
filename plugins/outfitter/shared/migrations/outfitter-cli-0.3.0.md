---
package: "@outfitter/cli"
version: 0.3.0
breaking: false
---

# @outfitter/cli → 0.3.0

## New APIs

### Global `--json` on `createCLI()`

`createCLI()` now registers `--json` globally, so every command inherits
structured output support by default.

```typescript
import { createCLI } from "@outfitter/cli/command";

const cli = createCLI({
  name: "my-tool",
  version: "1.2.3",
});

// All commands now receive --json automatically.
```

### `resolveVerbose()` Environment-Aware Verbosity

Use `resolveVerbose()` from `@outfitter/cli/output` to resolve verbosity with
shared precedence:

1. `OUTFITTER_VERBOSE` (`"1"` or `"0"`)
2. Explicit `--verbose` flag value
3. `OUTFITTER_ENV` profile defaults
4. `false`

```typescript
import { resolveVerbose } from "@outfitter/cli/output";

const verbose = resolveVerbose(flags.verbose);
```

### Human-First `output()` Defaults (Including Non-TTY)

`output()` now defaults to human mode unless JSON/JSONL is explicitly enabled.
This matches CLI conventions and avoids accidental machine output in piped runs.

```typescript
import { output } from "@outfitter/cli/output";

await output({ id: "123" }); // human by default
// JSON only when --json / OUTFITTER_JSON=1 / mode: "json"
```

## Migration Steps

### Remove Per-Command `--json` Flags

**Before:**

```typescript
command("list")
  .option("--json", "Output as JSON")
  .action(runList);
```

**After:**

```typescript
command("list").action(runList);
// Global --json is already provided by createCLI()
```

### Make Machine Output Explicit in Automation

If scripts relied on implicit JSON output in non-TTY contexts, opt in
explicitly now.

**Before:**

```bash
my-tool list | jq .
```

**After:**

```bash
my-tool --json list | jq .
# or
OUTFITTER_JSON=1 my-tool list | jq .
```

### Centralize Verbose Resolution

**Before:**

```typescript
const verbose = flags.verbose ?? process.env["DEBUG"] === "1";
```

**After:**

```typescript
const verbose = resolveVerbose(flags.verbose);
```

## No Action Required

- Existing `output()` and `exitWithError()` calls continue to work
- Command registration and handler signatures are unchanged
- JSONL behavior remains opt-in via `OUTFITTER_JSONL=1` or explicit mode
