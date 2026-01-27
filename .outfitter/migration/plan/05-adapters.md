# Stage 5: Adapters

**Status:** ⬜ Not Started
**Blocked By:** Handlers
**Unlocks:** Documents

## Objective

Wrap handlers with CLI and/or MCP transport adapters.

## CLI Commands



## MCP Tools



## CLI Patterns

### Output Modes

```typescript
// Automatic mode detection (TTY vs pipe)
await output(data);

// Force specific mode
await output(data, { mode: "json" });
await output(data, { mode: "human" });
```

### Error Handling

```typescript
if (result.isErr()) {
  exitWithError(result.error);
  // Prints error message
  // Exits with category-mapped code (1-9, 130)
}
```

### Testing CLI

```typescript
import { createCliHarness } from "@outfitter/testing";

const harness = createCliHarness(myCommand);

it("handles success", async () => {
  const result = await harness.run(["--id", "123"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("success");
});
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

- [ ] All CLI commands use `output()` and `exitWithError()`
- [ ] All MCP tools have `.describe()` on schema fields
- [ ] Handlers wrapped, not inlined
- [ ] Integration tests with harnesses
- [ ] Error codes verified

## Notes


