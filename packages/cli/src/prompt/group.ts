/**
 * Grouped prompts for wizard-style workflows.
 *
 * @packageDocumentation
 */

import type { Result } from "better-result";
import { Result as R } from "better-result";
import type { CancelledError, PromptResult } from "./types.js";
import { createCancelledError } from "./types.js";

/**
 * A step in a prompt group.
 */
export type PromptStep<T> = () => PromptResult<T>;

/**
 * Collects multiple prompts into a single result object.
 *
 * If any prompt is cancelled, the entire group fails with CancelledError.
 *
 * @param steps - Object of named prompt steps
 * @returns Ok with collected values or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptGroup, promptText, promptSelect } from "@outfitter/cli/prompt";
 *
 * const result = await promptGroup({
 *   name: () => promptText({ message: "Name:" }),
 *   role: () => promptSelect({
 *     message: "Role:",
 *     options: [
 *       { value: "admin", label: "Admin" },
 *       { value: "user", label: "User" },
 *     ],
 *   }),
 * });
 *
 * if (result.isOk()) {
 *   console.log(`Creating ${result.value.role}: ${result.value.name}`);
 * }
 * ```
 */
export async function promptGroup<T extends Record<string, unknown>>(
  steps: { [K in keyof T]: PromptStep<T[K]> }
): Promise<Result<T, CancelledError>> {
  const result: Partial<T> = {};

  for (const [key, step] of Object.entries(steps)) {
    const stepResult = await (step as PromptStep<unknown>)();

    if (stepResult.isErr()) {
      return R.err(createCancelledError(stepResult.error.message));
    }

    result[key as keyof T] = stepResult.value as T[keyof T];
  }

  return R.ok(result as T);
}
