import {
  Result,
  ValidationError,
  type HandlerContext,
} from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";

import { greetingInputSchema, type GreetingOutput } from "../types.js";

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
