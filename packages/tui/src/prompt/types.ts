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
  message: string;
  type: "cancelled";
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
  /** Default value */
  defaultValue?: string;
  /** Prompt message to display */
  message: string;
  /** Placeholder text */
  placeholder?: string;
  /** Validation function */
  validate?: Validator;
}

/**
 * Options for password prompts.
 */
export interface PasswordPromptOptions {
  /** Mask character (default: •) */
  mask?: string;
  /** Prompt message to display */
  message: string;
  /** Validation function */
  validate?: Validator;
}

/**
 * Options for select prompts.
 */
export interface SelectPromptOptions<T> {
  /** Initial selected index */
  initialValue?: T;
  /** Prompt message to display */
  message: string;
  /** Available options */
  options: Array<{
    value: T;
    label: string;
    hint?: string;
  }>;
  /** Maximum number of items to display at once */
  pageSize?: number;
}

/**
 * Options for multi-select prompts.
 */
export interface MultiSelectPromptOptions<T> {
  /** Initially selected values */
  initialValues?: T[];
  /** Prompt message to display */
  message: string;
  /** Available options */
  options: Array<{
    value: T;
    label: string;
    hint?: string;
  }>;
  /** Maximum number of items to display at once */
  pageSize?: number;
  /** Require at least one selection */
  required?: boolean;
}

/**
 * Options for confirm prompts.
 */
export interface ConfirmPromptOptions {
  /** Initial value */
  initialValue?: boolean;
  /** Prompt message to display */
  message: string;
}

/**
 * Type alias for prompt results.
 */
export type PromptResult<T> = Promise<Result<T, CancelledError>>;
