# CLI Command Template

Action-registry CLI action that wraps a handler.

## Template

```typescript
import { output } from "@outfitter/cli";
import { actionCliPresets } from "@outfitter/cli/actions";
import { cwdPreset, verbosePreset } from "@outfitter/cli/flags";
import { jqPreset, outputModePreset } from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";
import { myHandler } from "../handlers/my-handler.js";

const shared = actionCliPresets(verbosePreset(), cwdPreset());
const mode = outputModePreset({ includeJsonl: true });
const jq = jqPreset();

export const myAction = defineAction({
  id: "my.get",
  description: "Brief description of what this command does",
  surfaces: ["cli"],
  input: z.object({
    id: z.string().min(1),
    limit: z.number().int().positive().default(20),
    includeDeleted: z.boolean().default(false),
    verbose: z.boolean().optional(),
    cwd: z.string(),
    outputMode: z.enum(["human", "json", "jsonl"]).default("human"),
    jq: z.string().optional(),
  }),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
    total: z.number().int().nonnegative(),
  }),
  cli: {
    group: "my",
    command: "get <id>",
    options: [
      ...shared.options,
      ...mode.options,
      ...jq.options,
      {
        flags: "-l, --limit <n>",
        description: "Maximum number of results",
        defaultValue: "20",
      },
      {
        flags: "--include-deleted",
        description: "Include deleted items",
        defaultValue: false,
      },
    ],
    mapInput: ({ args, flags }) => ({
      id: String(args[0] ?? ""),
      limit: Number.parseInt(String(flags.limit ?? 20), 10),
      includeDeleted: Boolean(flags.includeDeleted),
      ...shared.resolve(flags),
      ...mode.resolve(flags),
      ...jq.resolve(flags),
    }),
  },
  handler: async (input, ctx) => {
    const result = await myHandler(
      {
        id: input.id,
        limit: input.limit,
        includeDeleted: input.includeDeleted,
      },
      ctx
    );

    if (result.isErr()) {
      return result;
    }

    await output(result.value, { mode: input.outputMode });
    return Result.ok(result.value);
  },
});
```

## Registration

```typescript
import { buildCliCommands } from "@outfitter/cli/actions";
import { createCLI } from "@outfitter/cli/command";
import { createActionRegistry } from "@outfitter/contracts";
import { myAction } from "./actions/my-action.js";
import { otherAction } from "./actions/other-action.js";

const cli = createCLI({
  name: "myapp",
  version: "1.0.0",
  description: "My CLI application",
});

const registry = createActionRegistry([myAction, otherAction]);

for (const command of buildCliCommands(registry, {
  schema: { programName: "myapp", surface: {} },
})) {
  cli.register(command);
}

await cli.parse();
```

## Schema Maintenance

```bash
myapp schema generate
myapp schema diff
```

## Checklist

- [ ] Action is defined with `defineAction()` and `surfaces: ["cli"]`
- [ ] Input/output schemas are declared with Zod
- [ ] Flag presets are composed first (`actionCliPresets`, `outputModePreset`, `jqPreset`)
- [ ] `mapInput()` normalizes args/flags into typed handler input
- [ ] Handler returns `Result` and uses `output(..., { mode: input.outputMode })`
- [ ] Action is registered via `buildCliCommands()`, not manual `command(...).action(...)`
- [ ] Surface map is regenerated and verified (`schema generate` + `schema diff`)

## Patterns

### Grouped Subcommands

```typescript
export const userCreateAction = defineAction({
  id: "user.create",
  surfaces: ["cli"],
  input: z.object({ email: z.string().email() }),
  output: z.object({ id: z.string() }),
  cli: { group: "user", command: "create <email>", options: [] },
  handler: async (input, ctx) => createUser(input, ctx),
});

export const userDeleteAction = defineAction({
  id: "user.delete",
  surfaces: ["cli"],
  input: z.object({ id: z.string().min(1), force: z.boolean().default(false) }),
  output: z.object({ deleted: z.boolean() }),
  cli: {
    group: "user",
    command: "delete <id>",
    options: [
      {
        flags: "--force",
        description: "Skip confirmation",
        defaultValue: false,
      },
    ],
  },
  handler: async (input, ctx) => deleteUser(input, ctx),
});
```

### Interactive Flags

```typescript
import { actionCliPresets } from "@outfitter/cli/actions";
import { interactionPreset } from "@outfitter/cli/flags";

const interaction = actionCliPresets(interactionPreset());

cli: {
  options: [...interaction.options],
  mapInput: ({ flags }) => ({
    ...interaction.resolve(flags),
  }),
}
```

## Test Template

```typescript
import { describe, expect, test } from "bun:test";
import { actions } from "../actions.js";

describe("my.get action", () => {
  test("is registered in the action registry", () => {
    const action = actions.get("my.get");
    expect(action).toBeDefined();
    expect(action?.cli?.group).toBe("my");
    expect(action?.cli?.command).toBe("get <id>");
  });

  test("maps CLI args and flags", () => {
    const action = actions.get("my.get");
    const mapped = action?.cli?.mapInput?.({
      args: ["abc123"],
      flags: { output: "json", limit: "5" },
    }) as { id: string; outputMode: string; limit: number };

    expect(mapped.id).toBe("abc123");
    expect(mapped.outputMode).toBe("json");
    expect(mapped.limit).toBe(5);
  });
});
```
