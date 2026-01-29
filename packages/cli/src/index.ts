/**
 * @outfitter/cli - CLI primitives for AI-agent-ready tooling
 *
 * Root export contains minimal essentials: colors and output.
 *
 * For rendering primitives:
 * - @outfitter/cli/table
 * - @outfitter/cli/list
 * - @outfitter/cli/box
 * - @outfitter/cli/tree
 * - @outfitter/cli/borders
 *
 * For CLI building:
 * - @outfitter/cli/command
 * - @outfitter/cli/actions
 * - @outfitter/cli/input
 * - @outfitter/cli/pagination
 *
 * Or use presets:
 * - @outfitter/cli/preset/standard
 * - @outfitter/cli/preset/full
 *
 * @packageDocumentation
 */

// Colors (theme and ANSI)
export {
  ANSI,
  createTheme,
  type Theme,
  type Tokens,
} from "./colors/index.js";

// Output (stdout/stderr abstraction)
export { output } from "./output.js";
export type { OutputMode } from "./types.js";
