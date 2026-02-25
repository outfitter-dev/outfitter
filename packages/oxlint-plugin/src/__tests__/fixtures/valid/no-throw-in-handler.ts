import { Result } from "@outfitter/contracts";

/**
 * Handlers return Result types instead of throwing.
 * This pattern keeps error handling explicit and composable.
 */
export function handleRequest(input: unknown): Result<string, Error> {
  if (!input) {
    return Result.err(new Error("Input is required"));
  }

  return Result.ok("success");
}

export function handleBatch(items: readonly string[]): Result<string[], Error> {
  const results: string[] = [];

  for (const item of items) {
    if (!item.trim()) {
      return Result.err(new Error(`Empty item in batch`));
    }
    results.push(item.toUpperCase());
  }

  return Result.ok(results);
}
