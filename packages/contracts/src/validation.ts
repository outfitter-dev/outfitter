import { Result } from "better-result";
import type { z } from "zod";
import { ValidationError } from "./errors.js";

/**
 * Format Zod issues into a human-readable error message.
 *
 * @param issues - Array of Zod validation issues
 * @returns Formatted error message string
 */
function formatZodIssues(issues: z.ZodIssue[]): string {
	return issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
			return `${path}: ${issue.message}`;
		})
		.join("; ");
}

/**
 * Extract the first field path from Zod issues (if any).
 *
 * @param issues - Array of Zod validation issues
 * @returns Field path string or undefined
 */
function extractField(issues: z.ZodIssue[]): string | undefined {
	const firstIssue = issues[0];
	if (firstIssue && firstIssue.path.length > 0) {
		return firstIssue.path.join(".");
	}
	return undefined;
}

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
 */
export function createValidator<T>(
	schema: z.ZodType<T>,
): (input: unknown) => Result<T, ValidationError> {
	return (input: unknown): Result<T, ValidationError> => {
		return validateInput(schema, input);
	};
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
 */
export function validateInput<T>(schema: z.ZodType<T>, input: unknown): Result<T, ValidationError> {
	const parseResult = schema.safeParse(input);

	if (parseResult.success) {
		return Result.ok(parseResult.data);
	}

	const message = formatZodIssues(parseResult.error.issues);
	const field = extractField(parseResult.error.issues);

	// Build error with optional field only if defined
	const errorProps: { message: string; field?: string } = { message };
	if (field !== undefined) {
		errorProps.field = field;
	}

	return Result.err(new ValidationError(errorProps));
}
