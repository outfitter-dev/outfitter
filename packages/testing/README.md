# @outfitter/testing

Test harnesses, fixtures, and utilities for Outfitter packages.

## Installation

```bash
bun add -d @outfitter/testing
```

## Quick Start

```typescript
import {
  createFixture,
  createCliHarness,
  createMcpHarness,
  withTempDir,
  withEnv,
} from "@outfitter/testing";

// Create reusable test fixtures
const createUser = createFixture({
  id: 1,
  name: "Test User",
  email: "test@example.com",
});

// Test CLI commands
const cli = createCliHarness("./bin/my-cli");
const result = await cli.run(["--help"]);
expect(result.exitCode).toBe(0);

// Test MCP tools
const harness = createMcpHarness(myMcpServer);
const tools = await harness.listTools();
const output = await harness.invoke("my-tool", { input: "value" });
```

## Fixtures

Factory functions for creating test data with sensible defaults.

### createFixture

Creates a fixture factory that returns new objects with optional overrides.

```typescript
import { createFixture } from "@outfitter/testing";

// Define defaults
const createUser = createFixture({
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  settings: { theme: "dark", notifications: true },
});

// Use defaults
const user1 = createUser();

// Override specific fields (supports deep merge)
const user2 = createUser({
  name: "Jane Doe",
  settings: { theme: "light" },
});
// Result: { id: 1, name: "Jane Doe", email: "john@example.com", settings: { theme: "light", notifications: true } }
```

Each call returns a fresh copy, preventing test pollution from shared mutable state.

#### Deep Merge Behavior

Overrides are deep-merged for nested objects:

```typescript
const createConfig = createFixture({
  env: {
    region: "us-east-1",
    flags: { beta: false, audit: true },
  },
  retries: 3,
});

const config = createConfig({
  env: { flags: { beta: true } },
});
// Result:
// {
//   env: { region: "us-east-1", flags: { beta: true, audit: true } },
//   retries: 3
// }
```

Notes:
- Arrays are replaced, not merged.
- `undefined` override values are ignored (defaults remain).

### withTempDir

Runs a function with an isolated temporary directory that is automatically cleaned up.

```typescript
import { withTempDir } from "@outfitter/testing";
import { join } from "node:path";

const result = await withTempDir(async (dir) => {
  // Write test files
  await Bun.write(join(dir, "config.json"), JSON.stringify({ key: "value" }));

  // Run code that operates on the directory
  return await processDirectory(dir);
});
// Directory is automatically removed after the callback
```

Cleanup occurs even if the callback throws an error.

### withEnv

Runs a function with temporary environment variables, restoring originals after.

```typescript
import { withEnv } from "@outfitter/testing";

await withEnv({ API_KEY: "test-key", DEBUG: "true" }, async () => {
  // process.env.API_KEY is "test-key"
  // process.env.DEBUG is "true"
  await runTests();
});
// Original environment is restored
```

## CLI Test Harness

Execute CLI commands and capture their output for assertions.

### createCliHarness

Creates a harness for testing command-line tools.

```typescript
import { createCliHarness } from "@outfitter/testing";

const harness = createCliHarness("./bin/my-cli");

// Test help output
const helpResult = await harness.run(["--help"]);
expect(helpResult.stdout).toContain("Usage:");
expect(helpResult.exitCode).toBe(0);

// Test error handling
const errorResult = await harness.run(["--invalid-flag"]);
expect(errorResult.stderr).toContain("Unknown option");
expect(errorResult.exitCode).toBe(1);

// Test with arguments
const result = await harness.run(["process", "--input", "data.json"]);
expect(result.stdout).toContain("Processed successfully");
```

### CliResult Interface

```typescript
interface CliResult {
  /** Standard output from the command */
  stdout: string;
  /** Standard error output from the command */
  stderr: string;
  /** Exit code (0 typically indicates success) */
  exitCode: number;
}
```

## MCP Test Harness

Test MCP (Model Context Protocol) server tool invocations.

### createMcpHarness

Creates a test harness from an MCP server for invoking and inspecting tools.

```typescript
import { createMcpHarness, type McpServer } from "@outfitter/testing";

// Create or mock an MCP server
const server: McpServer = {
  tools: [
    {
      name: "add",
      description: "Add two numbers",
      handler: ({ a, b }) => a + b,
    },
    {
      name: "greet",
      description: "Generate a greeting",
      handler: ({ name }) => `Hello, ${name}!`,
    },
  ],
  async invoke(toolName, input) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) throw new Error(`Tool not found: ${toolName}`);
    return tool.handler(input);
  },
};

// Create harness
const harness = createMcpHarness(server);

// List available tools
const tools = await harness.listTools();
expect(tools).toEqual(["add", "greet"]);

// Invoke tools with type inference
const sum = await harness.invoke<number>("add", { a: 2, b: 3 });
expect(sum).toBe(5);

const greeting = await harness.invoke<string>("greet", { name: "World" });
expect(greeting).toBe("Hello, World!");
```

### McpHarness Interface

```typescript
interface McpHarness {
  /** Invoke a tool by name with input parameters */
  invoke<T>(toolName: string, input: unknown): Promise<T>;
  /** List all available tool names */
  listTools(): Promise<string[]>;
}
```

### McpServer Interface

Minimal interface for MCP servers (can be real or mocked).

```typescript
interface McpServer {
  /** Array of tools registered on the server */
  tools: McpTool[];
  /** Invoke a tool by name with input */
  invoke(toolName: string, input: unknown): Promise<unknown>;
}

interface McpTool {
  /** Unique name of the tool */
  name: string;
  /** Human-readable description */
  description: string;
  /** Handler function for the tool */
  handler: McpToolHandler;
}

type McpToolHandler = (input: unknown) => unknown | Promise<unknown>;
```

## Subpath Exports

Import specific modules directly for smaller bundles:

```typescript
// Just fixtures
import { createFixture, withTempDir, withEnv } from "@outfitter/testing/fixtures";

// Just CLI harness
import { createCliHarness } from "@outfitter/testing/cli-harness";

// Just MCP harness
import { createMcpHarness } from "@outfitter/testing/mcp-harness";
```

## API Reference

### Fixtures

| Export | Description |
|--------|-------------|
| `createFixture<T>(defaults)` | Create a fixture factory with deep merge support |
| `withTempDir<T>(fn)` | Run callback with auto-cleaned temp directory |
| `withEnv<T>(vars, fn)` | Run callback with temporary environment variables |

### CLI Harness

| Export | Description |
|--------|-------------|
| `createCliHarness(command)` | Create a CLI test harness |
| `CliHarness` | Interface for CLI harness |
| `CliResult` | Interface for command execution result |

### MCP Harness

| Export | Description |
|--------|-------------|
| `createMcpHarness(server)` | Create an MCP test harness |
| `McpHarness` | Interface for MCP harness |
| `McpServer` | Interface for MCP server |
| `McpTool` | Interface for tool definition |
| `McpToolHandler` | Type for tool handler functions |

## Related Packages

- `@outfitter/cli` - CLI framework for building command-line tools
- `@outfitter/mcp` - MCP server framework with typed tools
- `@outfitter/contracts` - Result types and error patterns

## License

MIT
