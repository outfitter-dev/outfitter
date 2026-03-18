/**
 * {{projectName}} - String utility handlers.
 *
 * Each handler validates input at the boundary with Zod,
 * then returns a `Result<T, E>` with typed errors.
 */

import {
  Result,
  ValidationError,
  NotFoundError,
  type HandlerContext,
} from "@outfitter/contracts";

import {
  transformInputSchema,
  validateInputSchema,
  hashInputSchema,
  type TransformResult,
  type ValidateResult,
  type HashResult,
} from "./types.js";

// =============================================================================
// Transform
// =============================================================================

/**
 * Transform a string using the specified mode.
 *
 * @param input - Raw input to validate against {@link transformInputSchema}
 * @param ctx - Handler context with logger and request metadata
 * @returns Transformed string or a `ValidationError` / `NotFoundError`
 *
 * @example
 * ```typescript
 * const result = await transform({ text: "hello", mode: "uppercase" }, ctx);
 * if (result.isOk()) {
 *   console.log(result.value.transformed); // "HELLO"
 * }
 * ```
 */
export async function transform(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<TransformResult, ValidationError | NotFoundError>> {
  const parsed = transformInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid transform input",
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

  const { text, mode } = parsed.data;
  let transformed: string;

  switch (mode) {
    case "uppercase":
      transformed = text.toUpperCase();
      break;
    case "lowercase":
      transformed = text.toLowerCase();
      break;
    case "titlecase":
      transformed = text.replace(/\b\w/g, (char) => char.toUpperCase());
      break;
    case "reverse":
      transformed = [...text].toReversed().join("");
      break;
    default:
      return Result.err(NotFoundError.create("transform mode", mode as string));
  }

  ctx.logger.info(`Transformed text with mode=${mode}`, {
    requestId: ctx.requestId,
  });
  return Result.ok({ original: text, transformed, mode });
}

// =============================================================================
// Validate
// =============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a string against a known format (email, url, uuid).
 *
 * @param input - Raw input to validate against {@link validateInputSchema}
 * @param ctx - Handler context with logger and request metadata
 * @returns Validation result or a `ValidationError`
 */
export async function validate(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<ValidateResult, ValidationError>> {
  const parsed = validateInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid validate input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const { value, format } = parsed.data;
  let valid: boolean;

  switch (format) {
    case "email":
      valid = EMAIL_RE.test(value);
      break;
    case "url":
      try {
        valid = URL.canParse(value);
      } catch {
        valid = false;
      }
      break;
    case "uuid":
      valid = UUID_RE.test(value);
      break;
  }

  ctx.logger.info(`Validated ${format}`, { requestId: ctx.requestId });
  return Result.ok({ value, format, valid });
}

// =============================================================================
// Hash
// =============================================================================

/**
 * Hash a string using SHA-256 via `Bun.hash`.
 *
 * @param input - Raw input to validate against {@link hashInputSchema}
 * @param ctx - Handler context with logger and request metadata
 * @returns Hash result or a `ValidationError`
 */
export async function hash(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<HashResult, ValidationError>> {
  const parsed = hashInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid hash input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(parsed.data.text);
  const digest = hasher.digest("hex");

  ctx.logger.info("Hashed text with sha256", { requestId: ctx.requestId });
  return Result.ok({
    text: parsed.data.text,
    hash: digest,
    algorithm: "sha256",
  });
}
