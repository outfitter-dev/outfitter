import { type ZodType, z } from "zod";

export interface GreetingInput {
  readonly name: string;
  readonly excited: boolean;
}

export const greetingInputSchema: ZodType<GreetingInput> = z.object({
  name: z.string().min(1, "name is required"),
  excited: z.boolean().default(false),
});

export interface Greeting {
  readonly message: string;
  readonly issuedAt: string;
}
