/**
 * Confirmation prompt wrapper.
 *
 * @packageDocumentation
 */

import { confirm, isCancel } from "@clack/prompts";
import { Result } from "better-result";
import {
  type ConfirmPromptOptions,
  createCancelledError,
  type PromptResult,
} from "./types.js";

/**
 * Prompts for yes/no confirmation with Result wrapping.
 *
 * @param options - Confirm prompt options
 * @returns Ok with boolean or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptConfirm } from "@outfitter/cli/prompt";
 *
 * const result = await promptConfirm({
 *   message: "Are you sure you want to continue?",
 *   initialValue: false,
 * });
 *
 * if (result.isOk() && result.value) {
 *   console.log("Continuing...");
 * }
 * ```
 */
export async function promptConfirm(
  options: ConfirmPromptOptions
): PromptResult<boolean> {
  // Build options object, excluding undefined values for exactOptionalPropertyTypes
  const confirmOptions: Parameters<typeof confirm>[0] = {
    message: options.message,
  };
  if (options.initialValue !== undefined) {
    confirmOptions.initialValue = options.initialValue;
  }

  const result = await confirm(confirmOptions);

  if (isCancel(result)) {
    return Result.err(createCancelledError());
  }

  return Result.ok(result);
}
