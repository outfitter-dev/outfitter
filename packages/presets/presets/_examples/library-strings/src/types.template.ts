import { type ZodType, z } from "zod";

// =============================================================================
// Transform types
// =============================================================================

/** Supported string transformation modes. */
export type TransformMode = "uppercase" | "lowercase" | "titlecase" | "reverse";

/** Input for the transform handler. */
export interface TransformInput {
  readonly text: string;
  readonly mode: TransformMode;
}

/** Zod schema for validating transform input at the boundary. */
export const transformInputSchema: ZodType<TransformInput> = z.object({
  text: z.string().min(1, "text is required"),
  mode: z.enum(["uppercase", "lowercase", "titlecase", "reverse"]),
});

/** Result of a string transformation. */
export interface TransformResult {
  readonly original: string;
  readonly transformed: string;
  readonly mode: TransformMode;
}

// =============================================================================
// Validate types
// =============================================================================

/** Supported validation formats. */
export type ValidateFormat = "email" | "url" | "uuid";

/** Input for the validate handler. */
export interface ValidateInput {
  readonly value: string;
  readonly format: ValidateFormat;
}

/** Zod schema for validating validate input at the boundary. */
export const validateInputSchema: ZodType<ValidateInput> = z.object({
  value: z.string().min(1, "value is required"),
  format: z.enum(["email", "url", "uuid"]),
});

/** Result of a string validation check. */
export interface ValidateResult {
  readonly value: string;
  readonly format: ValidateFormat;
  readonly valid: boolean;
}

// =============================================================================
// Hash types
// =============================================================================

/** Input for the hash handler. */
export interface HashInput {
  readonly text: string;
}

/** Zod schema for validating hash input at the boundary. */
export const hashInputSchema: ZodType<HashInput> = z.object({
  text: z.string().min(1, "text is required"),
});

/** Result of hashing a string. */
export interface HashResult {
  readonly text: string;
  readonly hash: string;
  readonly algorithm: "sha256";
}
