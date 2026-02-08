# Getting Started

Build CLI tools, MCP servers, and daemons with Outfitter's shared infrastructure.

## Prerequisites

- **Bun >= 1.3.6** — Install from [bun.sh](https://bun.sh)
- **TypeScript knowledge** — Outfitter is TypeScript-first
- **Familiarity with Result types** — See [Patterns](./PATTERNS.md) if new to this style

## Quick Start

The fastest way to start is with the `outfitter` CLI:

```bash
# Scaffold a CLI project
bunx outfitter init cli my-cli
cd my-cli
bun install
bun run dev
```

**Output:**
```
my-cli v0.1.0

Usage: my-cli [command] [options]

Commands:
  example    Run example command
  help       Display help for command
```

This creates a working CLI with:
- Typed commands via Commander.js
- Output mode detection (human/JSON)
- Error handling with exit codes
- XDG-compliant config loading

`@outfitter/types` is optional. Install it when you need branded IDs or shared
type utility helpers across packages.

## Tutorial: Build a CLI App

CLIs are the fastest path to useful software. Build once, run anywhere, pipe to anything.

Let's build a simple note-taking CLI from scratch to understand the core patterns.

### 1. Create the Project

```bash
mkdir my-notes && cd my-notes
bun init -y
bun add @outfitter/cli @outfitter/contracts @outfitter/config
```

### 2. Define a Handler

Handlers are transport-agnostic functions that return `Result` types. Create `src/handlers/list-notes.ts`:

```typescript
import { Result, NotFoundError, type Handler, type HandlerContext } from "@outfitter/contracts";

interface ListNotesInput {
  limit?: number;
  tag?: string;
}

interface Note {
  id: string;
  title: string;
  tags: string[];
}

interface ListNotesOutput {
  notes: Note[];
  total: number;
}

// In-memory store for this example
const notes: Note[] = [
  { id: "1", title: "First note", tags: ["work"] },
  { id: "2", title: "Second note", tags: ["personal"] },
];

export const listNotes: Handler<ListNotesInput, ListNotesOutput, NotFoundError> = async (
  input,
  ctx
) => {
  ctx.logger.debug("Listing notes", { input });

  let filtered = notes;

  if (input.tag) {
    filtered = notes.filter((n) => n.tags.includes(input.tag!));
  }

  if (input.limit) {
    filtered = filtered.slice(0, input.limit);
  }

  return Result.ok({
    notes: filtered,
    total: filtered.length,
  });
};
```

### 3. Create the CLI

Create `src/cli.ts`:

```typescript
import { createCLI, command } from "@outfitter/cli/command";
import { output, exitWithError } from "@outfitter/cli/output";
import { createContext } from "@outfitter/contracts";
import { listNotes } from "./handlers/list-notes.js";

const cli = createCLI({
  name: "notes",
  version: "0.1.0",
  description: "A simple note-taking CLI",
});

cli.program
  .addCommand(
    command("list")
      .description("List all notes")
      .option("-l, --limit <n>", "Limit results", parseInt)
      .option("-t, --tag <tag>", "Filter by tag")
      .action(async ({ flags }) => {
        const ctx = createContext({});

        const result = await listNotes(
          { limit: flags.limit, tag: flags.tag },
          ctx
        );

        if (result.isErr()) {
          exitWithError(result.error);
        }

        await output(result.value);
      })
      .build()
  );

cli.program.parse();
```

### 4. Add Package Scripts

Update `package.json`:

```json
{
  "name": "my-notes",
  "type": "module",
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --outdir dist --target bun"
  },
  "bin": {
    "notes": "./dist/cli.js"
  }
}
```

### 5. Run It

```bash
# Human-readable output
bun run dev list
```

**Output:**
```
notes: 2 results

  1  First note   [work]
  2  Second note  [personal]
```

```bash
# JSON output (for piping)
bun run dev list --json
```

**Output:**
```json
{"notes":[{"id":"1","title":"First note","tags":["work"]},{"id":"2","title":"Second note","tags":["personal"]}],"total":2}
```

```bash
# With filters
bun run dev list --tag work --limit 5
```

**Output:**
```
notes: 1 result

  1  First note  [work]
```

## Tutorial: Build an MCP Server

MCP servers let AI agents call your code directly. If you want Claude or other agents to use your tools, this is how.

Let's create an MCP server with a simple calculator tool.

### 1. Create the Project

```bash
mkdir my-mcp && cd my-mcp
bun init -y
bun add @outfitter/mcp @outfitter/contracts
```

### 2. Define Tools

Create `src/tools/calculator.ts`:

```typescript
import { Result, ValidationError } from "@outfitter/contracts";
import { z } from "zod";

const AddInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export const addTool = {
  name: "add",
  description: "Add two numbers together",
  inputSchema: AddInputSchema,
  handler: async (input: z.infer<typeof AddInputSchema>) => {
    return Result.ok({ result: input.a + input.b });
  },
};

const MultiplyInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export const multiplyTool = {
  name: "multiply",
  description: "Multiply two numbers",
  inputSchema: MultiplyInputSchema,
  handler: async (input: z.infer<typeof MultiplyInputSchema>) => {
    return Result.ok({ result: input.a * input.b });
  },
};
```

### 3. Create the Server

Create `src/server.ts`:

```typescript
import { createMcpServer } from "@outfitter/mcp";
import { addTool, multiplyTool } from "./tools/calculator.js";

const server = createMcpServer({
  name: "calculator",
  version: "0.1.0",
  description: "A simple calculator MCP server",
});

server.registerTool(addTool);
server.registerTool(multiplyTool);

server.start();
```

### 4. Configure for Claude

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calculator": {
      "command": "bun",
      "args": ["run", "/path/to/my-mcp/src/server.ts"]
    }
  }
}
```

## Tutorial: Build a Daemon

Daemons run in the background, stay alive, and talk to other processes. Use them for indexers, watchers, or anything that needs to persist.

### 1. Create the Project

```bash
mkdir my-daemon && cd my-daemon
bun init -y
bun add @outfitter/daemon @outfitter/contracts @outfitter/logging
```

### 2. Create the Daemon

Create `src/daemon.ts`:

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
});

// Create the daemon
const daemon = createDaemon({
  name: "my-daemon",
  pidFile: getLockPath("my-daemon"),
  logger,
  shutdownTimeout: 10000,
});

// Set up health checks
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

// Set up IPC server
const ipcServer = createIpcServer(getSocketPath("my-daemon"));

ipcServer.onMessage(async (msg) => {
  const message = msg as { type: string };

  switch (message.type) {
    case "status":
      return { status: "ok", uptime: process.uptime() };
    case "health":
      return await healthChecker.check();
    default:
      return { error: "Unknown command" };
  }
});

// Register cleanup
daemon.onShutdown(async () => {
  logger.info("Shutting down...");
  await ipcServer.close();
});

// Start
async function main() {
  const startResult = await daemon.start();
  if (startResult.isErr()) {
    logger.error("Failed to start daemon", { error: startResult.error });
    process.exit(1);
  }

  await ipcServer.listen();
  logger.info("Daemon started", { socket: getSocketPath("my-daemon") });
}

main();
```

### 3. Create a Client

Create `src/client.ts` to communicate with the daemon:

```typescript
import { createIpcClient, getSocketPath } from "@outfitter/daemon";

async function main() {
  const client = createIpcClient(getSocketPath("my-daemon"));
  await client.connect();

  const status = await client.send<{ status: string; uptime: number }>({
    type: "status",
  });
  console.log("Daemon status:", status);

  const health = await client.send<{ healthy: boolean }>({ type: "health" });
  console.log("Health check:", health);

  client.close();
}

main();
```

### 4. Run It

```bash
# Start the daemon
bun run src/daemon.ts &

# Query it
bun run src/client.ts
```

## Environment Setup

The scaffolded projects include sensible defaults. If you're setting up manually, use strict TypeScript and Biome for formatting. See the [template tsconfig](https://github.com/outfitter-dev/outfitter/blob/main/templates/tsconfig.json) for recommended compiler options.

## Next Steps

- **[Patterns](./PATTERNS.md)** — Learn the conventions for handlers, errors, and validation
- **[Architecture](./ARCHITECTURE.md)** — Understand how packages fit together
- **Package READMEs** — Deep dive into specific packages:
  - [@outfitter/cli](../packages/cli/README.md) — Full CLI API reference
  - [@outfitter/contracts](../packages/contracts/README.md) — Result types and errors
  - [@outfitter/config](../packages/config/README.md) — Configuration loading
  - [@outfitter/daemon](../packages/daemon/README.md) — Daemon lifecycle
