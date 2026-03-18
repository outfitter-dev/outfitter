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
