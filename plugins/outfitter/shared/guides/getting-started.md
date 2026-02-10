# Getting Started with @outfitter/*

Quick onboarding for new agents and developers.

## First Handler in 5 Minutes

### 1. Install

```bash
bun add @outfitter/contracts zod
```

### 2. Write Handler

```typescript
// src/handlers/greet.ts
import { Result, ValidationError, createValidator, type Handler } from "@outfitter/contracts";
import { z } from "zod";

const InputSchema = z.object({
  name: z.string().min(1, "Name required"),
});

const validateInput = createValidator(InputSchema);

interface Output {
  greeting: string;
}

export const greet: Handler<unknown, Output, ValidationError> = async (rawInput, ctx) => {
  const inputResult = validateInput(rawInput);
  if (inputResult.isErr()) return inputResult;

  ctx.logger.debug("Greeting", { name: inputResult.value.name });

  return Result.ok({ greeting: `Hello, ${inputResult.value.name}!` });
};
```

### 3. Test Handler

```typescript
// src/__tests__/greet.test.ts
import { describe, test, expect } from "bun:test";
import { createContext } from "@outfitter/contracts";
import { greet } from "../handlers/greet.js";

describe("greet", () => {
  test("returns greeting for valid name", async () => {
    const ctx = createContext({});
    const result = await greet({ name: "World" }, ctx);

    expect(result.isOk()).toBe(true);
    expect(result.value.greeting).toBe("Hello, World!");
  });

  test("returns ValidationError for empty name", async () => {
    const ctx = createContext({});
    const result = await greet({ name: "" }, ctx);

    expect(result.isErr()).toBe(true);
    expect(result.error._tag).toBe("ValidationError");
  });
});
```

### 4. Run Tests

```bash
bun test
```

## Add CLI Adapter

```bash
bun add @outfitter/cli
```

```typescript
// src/commands/greet.ts
import { command, output, exitWithError } from "@outfitter/cli";
import { createContext } from "@outfitter/contracts";
import { greet } from "../handlers/greet.js";

export const greetCommand = command("greet")
  .description("Greet someone")
  .argument("<name>", "Name to greet")
  .action(async ({ args }) => {
    const ctx = createContext({});
    const result = await greet({ name: args.name }, ctx);

    if (result.isErr()) {
      exitWithError(result.error);
    }

    await output(result.value);
  })
  .build();
```

## Add MCP Adapter

```bash
bun add @outfitter/mcp
```

```typescript
// src/tools/greet.ts
import { defineTool } from "@outfitter/mcp";
import { z } from "zod";
import { greet } from "../handlers/greet.js";

export const greetTool = defineTool({
  name: "greet",
  description: "Greet someone by name",
  inputSchema: z.object({
    name: z.string().describe("Name to greet"),
  }),
  handler: async (input, ctx) => greet(input, ctx),
});
```

## Core Concepts

| Concept | What it is |
|---------|------------|
| **Handler** | Pure function: `(input, ctx) => Result<Output, Error>` |
| **Result** | Success (`Result.ok(value)`) or failure (`Result.err(error)`) |
| **Context** | Carries logger, config, signal, requestId |
| **Error Taxonomy** | 10 categories mapping to exit codes and HTTP status |

## Next Steps

- Read [patterns/handler.md](../patterns/handler.md) for handler deep-dive
- Read [patterns/errors.md](../patterns/errors.md) for error taxonomy
- Browse [templates/](../templates/) for copy-paste starter code
