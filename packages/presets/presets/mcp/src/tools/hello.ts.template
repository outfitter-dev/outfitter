/**
 * Hello tool - demonstrates MCP tool definition with Result types.
 */

import { Result, ValidationError } from "@outfitter/contracts";
import { defineTool } from "@outfitter/mcp";
import { type ZodType, z } from "zod";

/** Input for the hello tool. */
export interface HelloInput {
  readonly name: string;
}

/** Zod schema for hello tool input validation. */
export const helloInputSchema: ZodType<HelloInput> = z.object({
  name: z.string().min(1, "name must not be empty").describe("Name to greet"),
});

/** Output from the hello tool. */
export interface HelloOutput {
  readonly greeting: string;
}

/** Tool that greets a user by name. */
export const helloTool = defineTool({
  name: "hello",
  description: "Say hello to someone",
  inputSchema: helloInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (
    input,
    _ctx
  ): Promise<Result<HelloOutput, ValidationError>> => {
    // Demonstrate Result.err() for business logic errors
    if (input.name.toLowerCase() === "error") {
      return Result.err(
        ValidationError.create("name", "reserved name not allowed", {
          reserved: ["error"],
        })
      );
    }

    return Result.ok({ greeting: `Hello, ${input.name}!` });
  },
});
