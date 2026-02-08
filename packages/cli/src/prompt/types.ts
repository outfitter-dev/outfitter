/**
 * Prompt types and interfaces.
 *
 * @packageDocumentation
 */

import type { Result } from "better-result";
import type { Validator } from "./validators.js";

/**
 * Error returned when user cancels a prompt.
 */
export interface CancelledError {
  type: "cancelled";
  message: string;
}

/**
 * Creates a cancelled error.
 */
export function createCancelledError(
  message = "User cancelled"
): CancelledError {
  return { type: "cancelled", message };
}

/**
 * Options for text prompts.
 */
export interface TextPromptOptions {
  /** Prompt message to display */
  message: string;
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: string;
  /** Validation function */
  validate?: Validator;
}

/**
 * Options for password prompts.
 */
export interface PasswordPromptOptions {
  /** Prompt message to display */
  message: string;
  /** Validation function */
  validate?: Validator;
  /** Mask character (default: •) */
  mask?: string;
}

/**
 * Options for select prompts.
 */
export interface SelectPromptOptions<T> {
  /** Prompt message to display */
  message: string;
  /** Available options */
  options: Array<{
    value: T;
    label: string;
    hint?: string;
  }>;
  /** Initial selected index */
  initialValue?: T;
  /** Maximum number of items to display at once */
  pageSize?: number;
}

/**
 * Options for multi-select prompts.
 */
export interface MultiSelectPromptOptions<T> {
  /** Prompt message to display */
  message: string;
  /** Available options */
  options: Array<{
    value: T;
    label: string;
    hint?: string;
  }>;
  /** Initially selected values */
  initialValues?: T[];
  /** Require at least one selection */
  required?: boolean;
  /** Maximum number of items to display at once */
  pageSize?: number;
}

/**
 * Options for confirm prompts.
 */
export interface ConfirmPromptOptions {
  /** Prompt message to display */
  message: string;
  /** Initial value */
  initialValue?: boolean;
}

/**
 * Type alias for prompt results.
 */
export type PromptResult<T> = Promise<Result<T, CancelledError>>;
