import type { Handler } from "@outfitter/contracts";

export const badHandler: Handler<
  unknown,
  string
> = async (): Promise<string> => {
  return "not-a-result";
};
