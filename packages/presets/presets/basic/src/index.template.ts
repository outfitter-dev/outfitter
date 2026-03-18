/**
 * {{projectName}}
 *
 * {{description}}
 *
 * @packageDocumentation
 */

import {
  type HandlerContext,
  NotFoundError,
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

/** Input for finding a greeting by ID. */
export interface FindGreetingInput {
  readonly id: string;
}

/** Zod schema for validating find-greeting input at the boundary. */
export const findGreetingInputSchema: ZodType<FindGreetingInput> = z.object({
  id: z.string().min(1, "id is required"),
});

/**
 * Find a greeting by ID.
 *
 * @param input - Raw input to validate against findGreetingInputSchema
 * @param ctx - Handler context with request metadata and logger
 * @returns Greeting on success, ValidationError on invalid input, NotFoundError when ID does not exist
 */
export async function findGreeting(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Greeting, ValidationError | NotFoundError>> {
  const parsed = findGreetingInputSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(
      new ValidationError({ message: "Invalid input", field: "id" })
    );
  }

  if (parsed.data.id === "unknown") {
    return Result.err(NotFoundError.create("greeting", parsed.data.id));
  }

  ctx.logger.info(`Found greeting ${parsed.data.id}`, {
    requestId: ctx.requestId,
  });
  return Result.ok({ message: `Hello from greeting ${parsed.data.id}!` });
}
