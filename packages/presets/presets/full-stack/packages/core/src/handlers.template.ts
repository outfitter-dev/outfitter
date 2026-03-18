import {
  Result,
  ValidationError,
  type HandlerContext,
} from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";

import { greetingInputSchema, type Greeting } from "./types.js";

const logger = createLogger({ name: "{{projectName}}-core" });

/**
 * Create a greeting from validated input.
 *
 * @param input - Raw input to validate against {@link greetingInputSchema}
 * @param ctx - Handler context with request metadata
 * @returns Greeting on success, ValidationError on invalid input
 */
export async function createGreeting(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Greeting, ValidationError>> {
  const parsed = greetingInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.length
      ? String(firstIssue.path[0])
      : "input";
    return Result.err(
      new ValidationError({
        message: firstIssue
          ? `${firstIssue.path.join(".") || field}: ${firstIssue.message}`
          : "Invalid greeting input",
        field,
      })
    );
  }

  const suffix = parsed.data.excited ? "!" : ".";
  const greeting: Greeting = {
    message: `Hello, ${parsed.data.name}${suffix}`,
    issuedAt: new Date().toISOString(),
  };

  logger.info(`Created greeting for ${parsed.data.name}`, {
    requestId: ctx.requestId,
  });
  return Result.ok(greeting);
}
