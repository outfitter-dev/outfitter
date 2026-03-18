import {
  Result,
  NotFoundError,
  ValidationError,
  type HandlerContext,
} from "@outfitter/contracts";

import {
  findGreetingInputSchema,
  greetingInputSchema,
  type Greeting,
} from "./types.js";

/**
 * Create a greeting from unvalidated input.
 *
 * @param input - Raw input to validate against {@link greetingInputSchema}
 * @param ctx - Handler context with logger and request metadata
 * @returns Validated greeting or a `ValidationError` with field-level validation details
 *
 * @example
 * ```typescript
 * const result = await createGreeting({ name: "World" }, ctx);
 * if (result.isOk()) {
 *   console.log(result.value.message); // "Hello, World."
 * }
 * ```
 */
export async function createGreeting(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Greeting, ValidationError>> {
  const parsed = greetingInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid greeting input",
        field: issue?.path.join(".") || "input",
        context: {
          fields: parsed.error.issues.map((i) => ({
            path: i.path.join(".") || "input",
            message: i.message,
          })),
        },
      })
    );
  }

  const suffix = parsed.data.excited ? "!" : ".";
  const greeting: Greeting = {
    message: `Hello, ${parsed.data.name}${suffix}`,
    issuedAt: new Date().toISOString(),
  };

  ctx.logger.info(`Created greeting for ${parsed.data.name}`, {
    requestId: ctx.requestId,
  });
  return Result.ok(greeting);
}

/**
 * Find a greeting by ID.
 *
 * @param input - Raw input to validate against {@link findGreetingInputSchema}
 * @param ctx - Handler context with logger and request metadata
 * @returns Greeting on success, ValidationError on invalid input, NotFoundError when ID does not exist
 *
 * @example
 * ```typescript
 * const result = await findGreeting({ id: "abc" }, ctx);
 * if (result.isErr() && result.error.name === "NotFoundError") {
 *   console.log("Greeting not found");
 * }
 * ```
 */
export async function findGreeting(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Greeting, ValidationError | NotFoundError>> {
  const parsed = findGreetingInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid find input",
        field: issue?.path.join(".") || "id",
      })
    );
  }

  // Simulate a store lookup — "unknown" triggers not-found
  if (parsed.data.id === "unknown") {
    return Result.err(NotFoundError.create("greeting", parsed.data.id));
  }

  const greeting: Greeting = {
    message: `Hello from greeting ${parsed.data.id}!`,
    issuedAt: new Date().toISOString(),
  };

  ctx.logger.info(`Found greeting ${parsed.data.id}`, {
    requestId: ctx.requestId,
  });
  return Result.ok(greeting);
}
