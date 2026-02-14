/**
 * @outfitter/tui - Terminal UI rendering for AI-agent-ready tooling
 *
 * Provides rendering primitives, themes, streaming, and prompts.
 * Depends on @outfitter/cli for colors, terminal detection, and text utilities.
 *
 * For rendering primitives:
 * - @outfitter/tui/table
 * - @outfitter/tui/list
 * - @outfitter/tui/box
 * - @outfitter/tui/tree
 * - @outfitter/tui/borders
 *
 * For themes:
 * - @outfitter/tui/theme
 *
 * For streaming output:
 * - @outfitter/tui/streaming
 *
 * For interactive prompts:
 * - @outfitter/tui/prompt
 *
 * Or use presets:
 * - @outfitter/tui/preset/standard
 * - @outfitter/tui/preset/full
 *
 * @packageDocumentation
 */

// Re-export core render module
export {
  // Borders
  BORDERS,
  type BorderCharacters,
  type BorderStyle,
  // Box
  type Box,
  type BoxAlign,
  type BoxBorders,
  type BoxContent,
  type BoxOptions,
  type BoxSpacing,
  createBox,
  drawHorizontalLine,
  getBorderCharacters,
  // Indicators
  getIndicator,
  getProgressIndicator,
  // Spinner
  getSpinnerFrame,
  INDICATORS,
  type IndicatorCategory,
  type IndicatorSet,
  isUnicodeSupported,
  type LinePosition,
  // List
  type ListItem,
  type ListOptions,
  type ListStyle,
  type NestedListItem,
  normalizeBorders,
  normalizeMargin,
  normalizePadding,
  renderBox,
  renderList,
  renderSpinner,
  // Table
  renderTable,
  // Tree
  renderTree,
  SPINNERS,
  type SpinnerFrames,
  type SpinnerStyle,
  type TableOptions,
  TREE_GUIDES,
  type TreeGuideStyle,
  type TreeOptions,
} from "./render/index.js";
