/**
 * Terminal detection module.
 *
 * Re-exports all terminal detection utilities.
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
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
