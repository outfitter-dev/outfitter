# Stage 5: Adapters

**Status:** ⬜ Not Started
**Blocked By:** Handlers
**Unlocks:** Documents

## Objective

Wrap handlers with CLI and/or MCP transport adapters, using the action registry
as the default CLI integration path.

## CLI Actions

{{#each CLI_COMMANDS}}
### {{this.name}}

- **Handler:** `{{this.handler}}`
- **Current File:** `{{this.file}}`

#### Migration

- [ ] Define `defineAction()` with input and output schemas
- [ ] Compose shared CLI presets with `actionCliPresets(...)`
- [ ] Add `outputModePreset()` and `jqPreset()` for structured output
- [ ] Map args/flags in `cli.mapInput`
- [ ] Register action in the CLI registry consumed by `buildCliCommands()`
- [ ] Add tests for action registration and `mapInput()`
- [ ] Run schema drift checks (`schema generate` + `schema diff`)

```typescript
import { output } from "@outfitter/cli";
import { actionCliPresets } from "@outfitter/cli/actions";
import { cwdPreset, verbosePreset } from "@outfitter/cli/flags";
import { jqPreset, outputModePreset } from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";
import { {{this.handler}} } from "../handlers/{{this.handlerFile}}";

const shared = actionCliPresets(verbosePreset(), cwdPreset());
const mode = outputModePreset({ includeJsonl: true });
const jq = jqPreset();

export const {{this.name}}Action = defineAction({
  id: "{{this.name}}",
  description: "{{this.description}}",
  surfaces: ["cli"],
  input: z.object({
    {{this.inputFields}}
    verbose: z.boolean().optional(),
    cwd: z.string(),
    outputMode: z.enum(["human", "json", "jsonl"]).default("human"),
    jq: z.string().optional(),
  }),
  output: z.unknown(),
  cli: {
    command: "{{this.commandName}}",
    options: [
      ...shared.options,
      ...mode.options,
      ...jq.options,
      {{this.options}}
    ],
    mapInput: ({ args, flags }) => ({
      {{this.inputMapping}}
      ...shared.resolve(flags),
      ...mode.resolve(flags),
      ...jq.resolve(flags),
    }),
  },
  handler: async (input, ctx) => {
    const result = await {{this.handler}}(input, ctx);

    if (result.isErr()) {
      return result;
    }

    await output(result.value, { mode: input.outputMode });
    return Result.ok(result.value);
  },
});
```

---

{{/each}}

## MCP Tools

{{#each MCP_TOOLS}}
### {{this.name}}

- **Handler:** `{{this.handler}}`
- **Current File:** `{{this.file}}`

#### Migration

- [ ] Create tool with Zod schema
- [ ] Add `.describe()` to all fields
- [ ] Wrap handler
- [ ] Register with server
- [ ] Add integration test

```typescript
import { defineTool } from "@outfitter/mcp";
import { {{this.handler}} } from "../handlers/{{this.handlerFile}}";
import { z } from "zod";

export const {{this.name}}Tool = defineTool({
  name: "{{this.toolName}}",
  description: "{{this.description}}",
  schema: z.object({
    {{this.schemaFields}}
  }),
  handler: async (input, ctx) => {
    return {{this.handler}}(input, ctx);
  },
});
```

---

{{/each}}

## CLI Patterns

### Action Registry Wiring

```typescript
import { buildCliCommands } from "@outfitter/cli/actions";
import { createCLI } from "@outfitter/cli/command";

const cli = createCLI({ name: "myapp", version: "1.0.0" });

for (const command of buildCliCommands(actions, {
  schema: { programName: "myapp", surface: {} },
})) {
  cli.register(command);
}

await cli.parse();
```

### Output Modes

```typescript
const mode = outputModePreset({ includeJsonl: true });

cli: {
  options: [...mode.options],
  mapInput: ({ flags }) => ({
    ...mode.resolve(flags),
  }),
}
```

### Testing CLI Actions

```typescript
import { describe, expect, test } from "bun:test";

describe("my action", () => {
  test("is registered", () => {
    const action = actions.get("my.action");
    expect(action).toBeDefined();
  });

  test("maps input", () => {
    const action = actions.get("my.action");
    const mapped = action?.cli?.mapInput?.({
      args: ["123"],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});
```

### Schema Drift Guard

```bash
myapp schema generate
myapp schema diff
```

## MCP Patterns

### Tool Registration

```typescript
import { createMcpServer } from "@outfitter/mcp";

const server = createMcpServer({ name: "myapp" });
server.registerTool(myTool);
server.start();
```

### Testing MCP

```typescript
import { createMcpHarness } from "@outfitter/testing";

const harness = createMcpHarness(server);

it("handles tool call", async () => {
  const result = await harness.callTool("my-tool", { id: "123" });
  expect(result.isOk()).toBe(true);
});
```

## Completion Checklist

- [ ] CLI exposure is defined via action registry (`defineAction` + `buildCliCommands`)
- [ ] CLI actions use presets + `mapInput()` for typed input resolution
- [ ] All MCP tools have `.describe()` on schema fields
- [ ] Handlers are wrapped, not inlined
- [ ] Integration tests cover adapters
- [ ] Surface map drift checks pass

## Notes

{{ADAPTER_NOTES}}
