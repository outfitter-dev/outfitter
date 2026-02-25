/* oxlint-disable outfitter/handler-must-return-result */
import type { Handler } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";

export const goodHandler: Handler<unknown, string> = async (): Promise<
  Result<string, Error>
> => {
  return Result.ok("ok");
};
