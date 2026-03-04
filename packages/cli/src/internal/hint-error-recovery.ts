/**
 * Tier 2: Error category mapping — produces standard recovery actions
 * per error type using enriched ErrorCategory metadata.
 *
 * @internal
 */

import {
  retryableMap,
  type CLIHint,
  type ErrorCategory,
} from "@outfitter/contracts";

// =============================================================================
// Recovery Map
// =============================================================================

/**
 * Standard recovery hints for each error category.
 *
 * Maps each ErrorCategory to standard recovery CLIHints using the enriched
 * metadata from OS-347 (retryable flags, JSON-RPC codes).
 */
const CATEGORY_RECOVERY_MAP: Record<
  ErrorCategory,
  (cliName?: string, commandName?: string) => CLIHint[]
> = {
  validation: (cliName) => [
    {
      description: "Check input parameters and try again",
      command: cliName ? `${cliName} --help` : "--help",
      params: { retryable: retryableMap.validation },
    },
  ],
  not_found: (cliName) => [
    {
      description: "Verify the resource identifier exists",
      command: cliName ? `${cliName} list` : "list",
      params: { retryable: retryableMap.not_found },
    },
  ],
  conflict: (cliName, commandName) => {
    const cmd = commandName || "<previous-command>";
    return [
      {
        description: "Resolve the conflict and retry",
        command: cliName ? `${cliName} ${cmd} --force` : `${cmd} --force`,
        params: { retryable: retryableMap.conflict },
      },
    ];
  },
  permission: (cliName) => [
    {
      description: "Check your permissions or request access",
      command: cliName ? `${cliName} auth status` : "auth status",
      params: { retryable: retryableMap.permission },
    },
  ],
  timeout: (cliName, commandName) => {
    const cmd = commandName || "<previous-command>";
    return [
      {
        description: "Retry the operation — transient timeout may resolve",
        command: cliName ? `${cliName} ${cmd}` : cmd,
        params: { retryable: retryableMap.timeout },
      },
    ];
  },
  rate_limit: (cliName, commandName) => {
    const cmd = commandName || "<previous-command>";
    return [
      {
        description: "Wait and retry — rate limit will reset",
        command: cliName ? `${cliName} ${cmd}` : cmd,
        params: { retryable: retryableMap.rate_limit },
      },
    ];
  },
  network: (cliName, commandName) => {
    const cmd = commandName || "<previous-command>";
    return [
      {
        description: "Retry the operation — network issue may be transient",
        command: cliName ? `${cliName} ${cmd}` : cmd,
        params: { retryable: retryableMap.network },
      },
    ];
  },
  internal: (cliName) => [
    {
      description: "Report this error — unexpected internal failure",
      command: cliName ? `${cliName} --help` : "--help",
      params: { retryable: retryableMap.internal },
    },
  ],
  auth: (cliName) => [
    {
      description: "Authenticate or refresh your credentials",
      command: cliName ? `${cliName} auth login` : "auth login",
      params: { retryable: retryableMap.auth },
    },
  ],
  cancelled: (cliName, commandName) => {
    const cmd = commandName || "<previous-command>";
    return [
      {
        description: "Operation was cancelled — re-run to try again",
        command: cliName ? `${cliName} ${cmd}` : cmd,
        params: { retryable: retryableMap.cancelled },
      },
    ];
  },
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Produce standard recovery CLIHints for an error category (Tier 2).
 *
 * Uses the enriched ErrorCategory metadata (retryable flags from OS-347)
 * to generate appropriate recovery actions. Retryable categories include
 * retry hints; non-retryable categories guide toward root cause resolution.
 *
 * @param category - The error category
 * @param cliName - Optional CLI name for command hints
 * @param commandName - Optional command name to replace `<previous-command>` placeholder
 * @returns Array of recovery hints
 *
 * @example
 * ```typescript
 * const hints = errorRecoveryHints("conflict", "my-cli", "update");
 * // [{ description: "Resolve the conflict and retry",
 * //    command: "my-cli update --force",
 * //    params: { retryable: true } }]
 * ```
 */
export function errorRecoveryHints(
  category: ErrorCategory,
  cliName?: string,
  commandName?: string
): CLIHint[] {
  const factory = CATEGORY_RECOVERY_MAP[category];
  return factory(cliName, commandName);
}
