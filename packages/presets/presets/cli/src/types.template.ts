import { type ZodType, z } from "zod";

export interface GreetingInput {
  readonly name: string;
}

export const greetingInputSchema: ZodType<GreetingInput> = z.object({
  name: z.string().min(1, "name is required"),
});

export interface GreetingOutput {
  readonly message: string;
}

/** Input for the lookup handler. */
export interface LookupInput {
  readonly id: string;
}

/** Zod schema for validating lookup input at the boundary. */
export const lookupInputSchema: ZodType<LookupInput> = z.object({
  id: z.string().min(1, "id is required"),
});

/** Result of a successful lookup. */
export interface LookupOutput {
  readonly name: string;
  readonly found: boolean;
}
