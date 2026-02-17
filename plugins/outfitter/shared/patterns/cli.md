# CLI Patterns

Patterns for `@outfitter/cli` with schema introspection, flag presets, output contracts, and `@outfitter/tui` rendering.

## Package Roles

- `@outfitter/cli`: command builder, output contract, input helpers, pagination, schema command wiring.
- `@outfitter/tui`: visual rendering and interactive terminal UX (tables/lists/boxes/trees, themes, spinners, prompts).

Use `@outfitter/cli` for transport behavior and machine-friendly output. Use `@outfitter/tui` when you need richer human terminal presentation.

## Typical Imports

```typescript
import { output } from "@outfitter/cli";
import { command, createCLI } from "@outfitter/cli/command";
import { buildCliCommands } from "@outfitter/cli/actions";
import { exitWithError, resolveVerbose } from "@outfitter/cli/output";
import {
  composePresets,
  verbosePreset,
  cwdPreset,
  dryRunPreset,
  forcePreset,
  paginationPreset,
} from "@outfitter/cli/flags";
import { outputModePreset, jqPreset } from "@outfitter/cli/query";

import { renderTable, renderList } from "@outfitter/tui/render";
import { createSpinner } from "@outfitter/tui/streaming";
```

## `buildCliCommands()` + Auto Schema Command

When you build commands from an action registry, pass `schema` options to auto-register `schema` subcommands:

```typescript
const commands = buildCliCommands(registry, {
  schema: {
    programName: "mycli",
    surface: { cwd: process.cwd(), outputDir: ".outfitter" },
  },
});
```

Generated capabilities include:

- `mycli schema`
- `mycli schema show [action]`
- `mycli schema generate [--dry-run] [--snapshot <name>]`
- `mycli schema diff [--against <name>] [--from <a> --to <b>]`

This is the preferred path for surface-map generation and drift checks in CI.

## Flag Preset Composition

Compose shared option bundles instead of hand-writing flags per action.

```typescript
const shared = composePresets(
  verbosePreset(),
  cwdPreset(),
  dryRunPreset(),
  forcePreset(),
  queryPreset(),
  outputPreset(),
  paginationPreset(),
);

defineAction({
  id: "users.list",
  cli: {
    options: [...shared.options],
    mapInput: ({ flags }) => ({
      ...shared.resolve(flags),
    }),
  },
});
```

Core presets to know:

- `verbosePreset`, `cwdPreset`, `dryRunPreset`, `forcePreset`
- `outputPreset` (output-mode controls)
- `queryPreset` (selection/filter helpers)
- `paginationPreset` (cursor and page-size controls)
- `timeWindowPreset`, `executionPreset`, `strictPreset`, `projectionPreset`, `interactionPreset`, `colorPreset`

## Output Modes and Queryability

`output()` defaults to human mode. Structured output is explicit.

Priority:
1. explicit `mode` option
2. `OUTFITTER_JSONL=1`
3. `OUTFITTER_JSON=1`
4. `OUTFITTER_JSON=0` forces human
5. default human

```typescript
await output(data); // human
await output(data, { mode: "json" });
await output(data, { mode: "jsonl" });
```

Use `exitWithError()` to keep error output and exit codes aligned to taxonomy.

## `@outfitter/tui` Usage Guidance

Prefer raw `output()` when:
- response is primarily machine-consumed
- automation and stable JSON contracts are the priority

Use `@outfitter/tui` when:
- humans need dense visual summaries (tables/trees)
- long-running operations benefit from spinners/stream updates
- interactive prompts are needed

Keep handler logic transport-agnostic; format in CLI adapters only.
