/**
 * Select and multi-select prompt wrappers.
 *
 * @packageDocumentation
 */

import { isCancel, multiselect, select } from "@clack/prompts";
import { Result } from "better-result";
import {
  createCancelledError,
  type MultiSelectPromptOptions,
  type PromptResult,
  type SelectPromptOptions,
} from "./types.js";

/**
 * Prompts for single selection with Result wrapping.
 *
 * @param options - Select prompt options
 * @returns Ok with selected value or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptSelect } from "@outfitter/cli/prompt";
 *
 * const result = await promptSelect({
 *   message: "Pick a color:",
 *   options: [
 *     { value: "red", label: "Red", hint: "A warm color" },
 *     { value: "blue", label: "Blue", hint: "A cool color" },
 *   ],
 * });
 *
 * if (result.isOk()) {
 *   console.log(`You picked: ${result.value}`);
 * }
 * ```
 */
export async function promptSelect<T>(
  options: SelectPromptOptions<T>
): PromptResult<T> {
  // Map options to ensure correct type for Clack
  const clackOptions = options.options.map((opt) => {
    const mapped: { value: T; label: string; hint?: string } = {
      value: opt.value,
      label: opt.label,
    };
    if (opt.hint !== undefined) {
      mapped.hint = opt.hint;
    }
    return mapped;
  });

  // Build select options, excluding undefined values for exactOptionalPropertyTypes
  const selectOptions: Parameters<typeof select>[0] = {
    message: options.message,
    options: clackOptions as Parameters<typeof select>[0]["options"],
  };
  if (options.initialValue !== undefined) {
    selectOptions.initialValue = options.initialValue;
  }

  const result = await select(selectOptions);

  if (isCancel(result)) {
    return Result.err(createCancelledError());
  }

  return Result.ok(result as T);
}

/**
 * Prompts for multiple selections with Result wrapping.
 *
 * @param options - Multi-select prompt options
 * @returns Ok with array of selected values or Err with CancelledError
 *
 * @example
 * ```typescript
 * import { promptMultiSelect } from "@outfitter/cli/prompt";
 *
 * const result = await promptMultiSelect({
 *   message: "Select toppings:",
 *   options: [
 *     { value: "cheese", label: "Cheese" },
 *     { value: "pepperoni", label: "Pepperoni" },
 *     { value: "mushrooms", label: "Mushrooms" },
 *   ],
 *   required: true,
 * });
 * ```
 */
export async function promptMultiSelect<T>(
  options: MultiSelectPromptOptions<T>
): PromptResult<T[]> {
  // Map options to ensure correct type for Clack
  const clackOptions = options.options.map((opt) => {
    const mapped: { value: T; label: string; hint?: string } = {
      value: opt.value,
      label: opt.label,
    };
    if (opt.hint !== undefined) {
      mapped.hint = opt.hint;
    }
    return mapped;
  });

  // Build multiselect options, excluding undefined values for exactOptionalPropertyTypes
  const multiselectOptions: Parameters<typeof multiselect>[0] = {
    message: options.message,
    options: clackOptions as Parameters<typeof multiselect>[0]["options"],
  };
  if (options.initialValues !== undefined) {
    multiselectOptions.initialValues = options.initialValues;
  }
  if (options.required !== undefined) {
    multiselectOptions.required = options.required;
  }

  const result = await multiselect(multiselectOptions);

  if (isCancel(result)) {
    return Result.err(createCancelledError());
  }

  return Result.ok(result as T[]);
}
