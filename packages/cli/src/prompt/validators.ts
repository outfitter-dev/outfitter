/**
 * Validator factories for prompt input validation.
 *
 * @packageDocumentation
 */

/**
 * A validator function that returns an error message or undefined.
 */
export type Validator = (value: string) => string | undefined;

/**
 * Collection of validator factory functions.
 *
 * @example
 * ```typescript
 * import { validators } from "@outfitter/cli/prompt";
 *
 * const validate = validators.compose(
 *   validators.required(),
 *   validators.minLength(3),
 *   validators.email()
 * );
 *
 * const error = validate("ab");
 * // "Minimum 3 characters"
 * ```
 */
export const validators = {
  /**
   * Requires a non-empty value.
   *
   * @param message - Custom error message
   * @returns Validator function
   */
  required:
    (message = "Required"): Validator =>
    (value: string) =>
      value.length > 0 ? undefined : message,

  /**
   * Requires minimum character length.
   *
   * @param length - Minimum length
   * @param message - Custom error message
   * @returns Validator function
   */
  minLength:
    (length: number, message?: string): Validator =>
    (value: string) =>
      value.length >= length
        ? undefined
        : (message ?? `Minimum ${length} characters`),

  /**
   * Requires maximum character length.
   *
   * @param length - Maximum length
   * @param message - Custom error message
   * @returns Validator function
   */
  maxLength:
    (length: number, message?: string): Validator =>
    (value: string) =>
      value.length <= length
        ? undefined
        : (message ?? `Maximum ${length} characters`),

  /**
   * Requires value to match a regex pattern.
   *
   * @param regex - Pattern to match
   * @param message - Error message when pattern doesn't match
   * @returns Validator function
   */
  pattern:
    (regex: RegExp, message: string): Validator =>
    (value: string) =>
      regex.test(value) ? undefined : message,

  /**
   * Validates email format.
   *
   * @param message - Custom error message
   * @returns Validator function
   */
  email: (message = "Invalid email"): Validator =>
    validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message),

  /**
   * Composes multiple validators, returning the first error.
   *
   * @param fns - Validators to compose
   * @returns Combined validator function
   */
  compose:
    (...fns: Validator[]): Validator =>
    (value: string) => {
      for (const fn of fns) {
        const error = fn(value);
        if (error) return error;
      }
      return undefined;
    },
};
