---
name: scaffold
version: 0.1.0
description: Creates handlers, CLI commands, MCP tools, and daemon services following Outfitter Stack conventions. Use when adding new components to a project, scaffolding code, or when "create handler", "new command", "add tool", or "daemon service" are mentioned.
allowed-tools: Read Write Edit Glob Grep
argument-hint: [component type]
---

# Scaffold Stack Components

Templates for creating @outfitter/* components.

## Component Types

| Type | Package | Template |
|------|---------|----------|
| Handler | `@outfitter/contracts` | [handler](#handler) |
| CLI Command | `@outfitter/cli` | [cli-command](#cli-command) |
| MCP Tool | `@outfitter/mcp` | [mcp-tool](#mcp-tool) |
| Daemon | `@outfitter/daemon` | [daemon-service](#daemon-service) |

## Handler

Transport-agnostic business logic returning `Result<T, E>`:

```typescript
import {
  Result,
  ValidationError,
  NotFoundError,
  createValidator,
  type Handler,
} from "@outfitter/contracts";
import { z } from "zod";

// 1. Input schema
const InputSchema = z.object({
  id: z.string().min(1),
});
type Input = z.infer<typeof InputSchema>;

// 2. Output type
interface Output {
  id: string;
  name: string;
}

// 3. Validator
const validateInput = createValidator(InputSchema);

// 4. Handler
export const myHandler: Handler<unknown, Output, ValidationError | NotFoundError> = async (
  rawInput,
  ctx
) => {
  const inputResult = validateInput(rawInput);
  if (inputResult.isErr()) return inputResult;
  const input = inputResult.value;

  ctx.logger.debug("Processing", { id: input.id });

  const resource = await fetchResource(input.id);
  if (!resource) {
    return Result.err(NotFoundError.create("resource", input.id));
  }

  return Result.ok(resource);
};
```

## CLI Command

For Outfitter apps, define CLI behavior in the action registry and let
`buildCliCommands()` wire Commander for you.

```typescript
import { actionCliPresets } from "@outfitter/cli/actions";
import { output } from "@outfitter/cli";
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
  description: "Get a resource",
  surfaces: ["cli"],
  input: z.object({
    id: z.string().min(1),
    verbose: z.boolean().optional(),
    cwd: z.string(),
    outputMode: z.enum(["human", "json", "jsonl"]).default("human"),
    jq: z.string().optional(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
  }),
  cli: {
    group: "my",
    command: "get <id>",
    options: [...shared.options, ...mode.options, ...jq.options],
    mapInput: ({ args, flags }) => ({
      id: String(args[0] ?? ""),
      ...shared.resolve(flags),
      ...mode.resolve(flags),
      ...jq.resolve(flags),
    }),
  },
  handler: async (input, ctx) => {
    const result = await myHandler({ id: input.id }, ctx);
    if (result.isErr()) {
      return result;
    }

    await output(result.value, { mode: input.outputMode });
    return Result.ok(result.value);
  },
});
```

Register in CLI:

```typescript
import { buildCliCommands } from "@outfitter/cli/actions";
import { createCLI } from "@outfitter/cli/command";
import { createActionRegistry } from "@outfitter/contracts";
import { myAction } from "./actions/my-action.js";

const cli = createCLI({ name: "myapp", version: "1.0.0" });
const registry = createActionRegistry([myAction]);

for (const command of buildCliCommands(registry, {
  schema: { programName: "myapp", surface: {} },
})) {
  cli.register(command);
}

await cli.parse();
```

After adding actions:

```bash
myapp schema generate
myapp schema diff
```

## MCP Tool

Zod schema with Result return:

```typescript
import { Result, ValidationError } from "@outfitter/contracts";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().describe("Search query"),
  limit: z.number().int().positive().default(10).describe("Max results"),
});

interface Output {
  results: Array<{ id: string; title: string }>;
  total: number;
}

export const myTool = {
  name: "my_tool",
  description: "Tool description for AI agent",
  inputSchema: InputSchema,

  handler: async (
    input: z.infer<typeof InputSchema>
  ): Promise<Result<Output, ValidationError>> => {
    const results = await search(input.query, input.limit);
    return Result.ok({ results, total: results.length });
  },
};
```

Register in server:

```typescript
import { createMcpServer } from "@outfitter/mcp";
import { myTool } from "./tools/my-tool.js";

const server = createMcpServer({ name: "my-server", version: "0.1.0" });
server.registerTool(myTool);
server.start();
```

## Daemon Service

Background service with health checks and IPC:

```typescript
import {
  createDaemon,
  createIpcServer,
  createHealthChecker,
  getSocketPath,
  getLockPath,
} from "@outfitter/daemon";
import { createLogger, createConsoleSink } from "@outfitter/logging";
import { Result } from "@outfitter/contracts";

const logger = createLogger({
  name: "my-daemon",
  level: "info",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});

const daemon = createDaemon({
  name: "my-daemon",
  pidFile: getLockPath("my-daemon"),
  logger,
  shutdownTimeout: 10000,
});

const healthChecker = createHealthChecker([
  {
    name: "memory",
    check: async () => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      return used < 500
        ? Result.ok(undefined)
        : Result.err(new Error(`High memory: ${used.toFixed(2)}MB`));
    },
  },
]);

const ipcServer = createIpcServer(getSocketPath("my-daemon"));

ipcServer.onMessage(async (msg) => {
  const message = msg as { type: string };
  switch (message.type) {
    case "status": return { status: "ok", uptime: process.uptime() };
    case "health": return await healthChecker.check();
    default: return { error: "Unknown command" };
  }
});

daemon.onShutdown(async () => {
  logger.info("Shutting down...");
  await ipcServer.close();
});

async function main() {
  const startResult = await daemon.start();
  if (startResult.isErr()) {
    logger.error("Failed to start", { error: startResult.error });
    process.exit(1);
  }
  await ipcServer.listen();
  logger.info("Started", { socket: getSocketPath("my-daemon") });
}

main();
```

## Best Practices

1. **Handler First** — Write handler before adapter (CLI/MCP/API)
2. **Action Registry First** — Add CLI behavior via `defineAction()` and `mapInput()`
3. **Preset Composition** — Prefer shared presets over manual flag parsing
4. **Schema Drift Guard** — Regenerate and diff `.outfitter/surface.json` after CLI changes
5. **Validate Early** — Use `createValidator` at handler entry
6. **Type Errors** — List all error types in handler signature
7. **Context Propagation** — Pass context through all handler calls
8. **Test Handlers** — Test handlers directly without transport layer

## References

- [templates/handler.md](templates/handler.md)
- [templates/cli-command.md](templates/cli-command.md)
- [templates/mcp-tool.md](templates/mcp-tool.md)
- [templates/daemon-service.md](templates/daemon-service.md)
