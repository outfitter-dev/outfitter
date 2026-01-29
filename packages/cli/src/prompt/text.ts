/**
 * Text and password prompt wrappers.
 *
 * @packageDocumentation
 */

import { isCancel, password, text } from "@clack/prompts";
import { Result } from "better-result";
import {
  createCancelledError,
  type PasswordPromptOptions,
  type PromptResult,
  type TextPromptOptions,
} from "./types.js";

/**
 * Prompts for text input with Result wrapping.
 *
 * @param options - Text prompt options
 * @returns Ok with value or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptText } from "@outfitter/cli/prompt";
 *
 * const result = await promptText({
 *   message: "What is your name?",
 *   placeholder: "Enter your name",
 *   validate: (v) => v.length > 0 || "Name is required",
 * });
 *
 * if (result.isOk()) {
 *   console.log(`Hello, ${result.value}!`);
 * }
 * ```
 */
export async function promptText(
  options: TextPromptOptions
): PromptResult<string> {
  // Build options object, excluding undefined values for exactOptionalPropertyTypes
  const textOptions: Parameters<typeof text>[0] = {
    message: options.message,
  };
  if (options.placeholder !== undefined) {
    textOptions.placeholder = options.placeholder;
  }
  if (options.defaultValue !== undefined) {
    textOptions.defaultValue = options.defaultValue;
  }
  if (options.validate !== undefined) {
    textOptions.validate = options.validate;
  }

  const result = await text(textOptions);

  if (isCancel(result)) {
    return Result.err(createCancelledError());
  }

  return Result.ok(result);
}

/**
 * Prompts for password input with Result wrapping.
 *
 * @param options - Password prompt options
 * @returns Ok with value or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptPassword } from "@outfitter/cli/prompt";
 *
 * const result = await promptPassword({
 *   message: "Enter your password:",
 *   validate: (v) => v.length >= 8 || "Password too short",
 * });
 * ```
 */
export async function promptPassword(
  options: PasswordPromptOptions
): PromptResult<string> {
  // Build options object, excluding undefined values for exactOptionalPropertyTypes
  const passwordOptions: Parameters<typeof password>[0] = {
    message: options.message,
    mask: options.mask ?? "•",
  };
  if (options.validate !== undefined) {
    passwordOptions.validate = options.validate;
  }

  const result = await password(passwordOptions);

  if (isCancel(result)) {
    return Result.err(createCancelledError());
  }

  return Result.ok(result);
}
