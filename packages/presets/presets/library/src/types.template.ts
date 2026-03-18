import { type ZodType, z } from "zod";

/** Input for the greeting handler. */
export interface GreetingInput {
  readonly name: string;
  readonly excited: boolean;
}

/** Zod schema for validating greeting input at the boundary. */
export const greetingInputSchema: ZodType<GreetingInput> = z.object({
  name: z.string().min(1, "name is required"),
  excited: z.boolean().default(false),
});

/** A generated greeting with timestamp. */
export interface Greeting {
  readonly message: string;
  readonly issuedAt: string;
}

/** Input for finding a greeting by ID. */
export interface FindGreetingInput {
  readonly id: string;
}

/** Zod schema for validating find-greeting input at the boundary. */
export const findGreetingInputSchema: ZodType<FindGreetingInput> = z.object({
  id: z.string().min(1, "id is required"),
});
