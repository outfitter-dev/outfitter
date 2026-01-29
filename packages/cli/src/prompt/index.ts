/**
 * Prompt module for @outfitter/cli.
 *
 * Provides Result-wrapped prompts using Clack, with validators and
 * group utilities for wizard-style workflows.
 *
 * @example
 * ```typescript
 * import {
 *   promptText,
 *   promptSelect,
 *   promptConfirm,
 *   promptGroup,
 *   validators,
 * } from "@outfitter/cli/prompt";
 *
 * // Single prompt
 * const name = await promptText({
 *   message: "Name:",
 *   validate: validators.required(),
 * });
 *
 * // Grouped prompts
 * const config = await promptGroup({
 *   name: () => promptText({ message: "Name:" }),
 *   debug: () => promptConfirm({ message: "Debug mode?" }),
 * });
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export { promptConfirm } from "./confirm.js";
export { type PromptStep, promptGroup } from "./group.js";
export { promptMultiSelect, promptSelect } from "./select.js";
export { promptPassword, promptText } from "./text.js";
export {
  type CancelledError,
  type ConfirmPromptOptions,
  createCancelledError,
  type MultiSelectPromptOptions,
  type PasswordPromptOptions,
  type PromptResult,
  type SelectPromptOptions,
  type TextPromptOptions,
} from "./types.js";
export { type Validator, validators } from "./validators.js";
