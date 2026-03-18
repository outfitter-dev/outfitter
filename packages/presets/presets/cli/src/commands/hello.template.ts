import {
  Result,
  NotFoundError,
  ValidationError,
  type HandlerContext,
} from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";

import {
  greetingInputSchema,
  lookupInputSchema,
  type GreetingOutput,
  type LookupOutput,
} from "../types.js";

const logger = createLogger({ name: "{{binName}}" });

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
): Promise<Result<GreetingOutput, ValidationError>> {
  const parsed = greetingInputSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(
      new ValidationError({ message: "Invalid greeting input", field: "name" })
    );
  }

  const message = `Hello, ${parsed.data.name}!`;
  logger.info(message, { requestId: ctx.requestId });
  return Result.ok({ message });
}

/**
 * Look up an item by ID.
 *
 * @param input - Raw input to validate against lookupInputSchema
 * @param ctx - Handler context with request metadata and logger
 * @returns Item on success, ValidationError on invalid input, NotFoundError when item does not exist
 */
export async function lookup(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<LookupOutput, ValidationError | NotFoundError>> {
  const parsed = lookupInputSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(
      new ValidationError({ message: "Invalid lookup input", field: "id" })
    );
  }

  if (parsed.data.id === "unknown") {
    return Result.err(NotFoundError.create("item", parsed.data.id));
  }

  logger.info(`Found item ${parsed.data.id}`, { requestId: ctx.requestId });
  return Result.ok({ name: `Item ${parsed.data.id}`, found: true });
}
