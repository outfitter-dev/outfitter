/**
 * Terminal detection module.
 *
 * Re-exports all terminal detection utilities.
 *
 * @packageDocumentation
 */

// eslint-disable-next-line oxc/no-barrel-file -- intentional re-exports for subpath API
export {
  getEnvValue,
  getTerminalWidth,
  hasNoColorEnv,
  isInteractive,
  resolveColorEnv,
  resolveForceColorEnv,
  supportsColor,
  type TerminalOptions,
} from "./detection.js";
