/**
 * {{projectName}}
 *
 * {{description}}
 *
 * @packageDocumentation
 */

import {
  type HandlerContext,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import { type ZodType, z } from "zod";

export interface GreetingInput {
  readonly name: string;
}

export const greetingInputSchema: ZodType<GreetingInput> = z.object({
  name: z.string().min(1, "name is required"),
});

export interface Greeting {
  readonly message: string;
}

/**
 * Generate a greeting for the given name.
 *
 * @param input - Raw input to validate against greetingInputSchema
 * @param ctx - Handler context with request metadata and logger
 * @returns Greeting message on success, ValidationError on invalid input
 */
export async function greet(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Greeting, ValidationError>> {
  const parsed = greetingInputSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(
      new ValidationError({ message: "Invalid input", field: "name" })
    );
  }

  ctx.logger.info(`Greeting ${parsed.data.name}`, {
    requestId: ctx.requestId,
  });
  return Result.ok({ message: `Hello, ${parsed.data.name}!` });
}
