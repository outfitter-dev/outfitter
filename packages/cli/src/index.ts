/**
 * @outfitter/cli - CLI primitives for AI-agent-ready tooling
 *
 * Root export contains minimal essentials: colors, text utilities, and output.
 *
 * For CLI building:
 * - @outfitter/cli/command
 * - @outfitter/cli/actions
 * - @outfitter/cli/input
 * - @outfitter/cli/pagination
 *
 * For terminal detection:
 * - @outfitter/cli/terminal
 *
 * For rendering and TUI components, use @outfitter/tui.
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
