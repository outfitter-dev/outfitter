import type { Result } from "better-result";
import type { z } from "zod";
import type { ValidationError } from "./errors.js";

/**
 * Create a validator function from a Zod schema.
 *
 * @typeParam T - The validated output type
 * @param schema - Zod schema to validate against
 * @returns A function that validates input and returns Result
 *
 * @example
 * ```typescript
 * const NoteSchema = z.object({
 *   id: z.string().uuid(),
 *   title: z.string().min(1),
 * });
 *
 * const validateNote = createValidator(NoteSchema);
 * const result = validateNote(input); // Result<Note, ValidationError>
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function createValidator<T>(
	_schema: z.ZodType<T>,
): (input: unknown) => Result<T, ValidationError> {
	throw new Error("Not implemented");
}

/**
 * Validate input against a Zod schema.
 *
 * Standardized wrapper for Zod schemas that returns Result instead of throwing.
 *
 * @typeParam T - The validated output type
 * @param schema - Zod schema to validate against
 * @param input - Unknown input to validate
 * @returns Result with validated data or ValidationError
 *
 * @example
 * ```typescript
 * const result = validateInput(NoteSchema, userInput);
 * if (result.isErr()) {
 *   console.error(result.unwrapErr().message);
 * }
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function validateInput<T>(
	_schema: z.ZodType<T>,
	_input: unknown,
): Result<T, ValidationError> {
	throw new Error("Not implemented");
}
