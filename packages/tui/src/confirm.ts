/**
 * Destructive operation confirmation prompt.
 *
 * @packageDocumentation
 */

import { CancelledError } from "@outfitter/contracts";
import { Err, Ok, type Result } from "better-result";

/**
 * Options for confirmDestructive().
 */
export interface ConfirmDestructiveOptions {
  /** Message to display to the user */
  readonly message: string;

  /** Whether to bypass confirmation (e.g., --yes flag) */
  readonly bypassFlag?: boolean;

  /** Number of items affected (shown in confirmation) */
  readonly itemCount?: number;
}

/**
 * Prompt for confirmation before destructive operations.
 *
 * Respects --yes flag for non-interactive mode.
 *
 * @param options - Confirmation options
 * @returns Whether the user confirmed
 *
 * @example
 * ```typescript
 * const confirmed = await confirmDestructive({
 *   message: "Delete 5 notes?",
 *   bypassFlag: flags.yes,
 *   itemCount: 5,
 * });
 *
 * if (confirmed.isErr()) {
 *   // User cancelled
 *   process.exit(0);
 * }
 * ```
 */
export async function confirmDestructive(
  options: ConfirmDestructiveOptions
): Promise<Result<boolean, InstanceType<typeof CancelledError>>> {
  const { message, bypassFlag = false, itemCount } = options;

  // If bypass flag is set, skip confirmation
  if (bypassFlag) {
    return new Ok(true);
  }

  // Check if we're in a TTY environment
  const isTTY = process.stdout.isTTY;
  const isDumbTerminal = process.env["TERM"] === "dumb";

  if (!isTTY || isDumbTerminal) {
    // Can't prompt in non-TTY or dumb terminal - return Err
    return new Err(
      new CancelledError({
        message:
          "Cannot prompt for confirmation in non-interactive mode. Use --yes to bypass.",
      })
    );
  }

  // Build the prompt message
  let promptMessage = message;
  if (itemCount !== undefined) {
    promptMessage = `${message} (${itemCount} items)`;
  }

  const { confirm, isCancel } = await import("@clack/prompts");
  const response = await confirm({ message: promptMessage });

  if (isCancel(response) || response === false) {
    return new Err(
      new CancelledError({
        message: "Operation cancelled by user.",
      })
    );
  }

  return new Ok(true);
}
