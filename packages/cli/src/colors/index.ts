/**
 * Colors submodule for @outfitter/cli.
 *
 * Provides ANSI escape codes, theme creation, and color utilities.
 *
 * @example
 * ```typescript
 * import { createTheme, ANSI, type Theme } from "@outfitter/cli/colors";
 *
 * const theme = createTheme();
 * console.log(theme.success("Done!"));
 * console.log(theme.error("Failed!"));
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  ANSI,
  applyColor,
  type ColorName,
  createTheme,
  createTokens,
  resolveTokenColorEnabled,
  type Theme,
  type TokenOptions,
  type Tokens,
} from "./colors.js";
