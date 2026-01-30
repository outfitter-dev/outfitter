/**
 * Render module.
 *
 * Re-exports all rendering utilities for terminal output.
 *
 * @packageDocumentation
 */

// Visual Theme System
// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export {
  boldTheme,
  type CreateVisualThemeOptions,
  createThemedContext,
  createVisualTheme,
  defaultTheme,
  type GlyphPair,
  getContextTheme,
  type MarkerSpec,
  minimalTheme,
  type PartialVisualTheme,
  resolveGlyph,
  resolveStateMarker,
  roundedTheme,
  type SemanticState,
  type ThemeColors,
  type ThemedContextOptions,
  type ThemedLayoutContext,
  type ThemeSpacing,
  type VisualTheme,
} from "../theme/index.js";
export {
  // Box-drawing borders
  BORDERS,
  type BorderCharacters,
  type BorderStyle,
  drawHorizontalLine,
  getBorderCharacters,
  type LinePosition,
} from "./borders.js";
// Box rendering
export {
  type Box,
  type BoxAlign,
  type BoxBorders,
  type BoxContent,
  type BoxOptions,
  type BoxSpacing,
  createBox,
  type NormalizedBorders,
  type NormalizedSpacing,
  normalizeBorders,
  normalizeMargin,
  normalizePadding,
  renderBox,
} from "./box.js";
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
// Date range parsing
export {
  type DateRange,
  endOfDay,
  parseDateRange,
  startOfDay,
} from "./date.js";
// Duration and byte formatting
export { formatBytes, formatDuration } from "./format.js";
// Date/time formatting
export { formatRelative } from "./format-relative.js";
// Heading rendering
export {
  type CaseMode,
  type HeadingOptions,
  type HeadingWidthMode,
  renderHeading,
  type SeparatorStyle,
} from "./heading.js";
// Indicators
export {
  getIndicator,
  getProgressIndicator,
  INDICATORS,
  type IndicatorCategory,
  type IndicatorSet,
  isUnicodeSupported,
  type ProgressStyle,
} from "./indicators.js";
// JSON and text rendering
export { renderJson, renderText } from "./json.js";
// Layout utilities
export {
  type Alignment,
  createLayoutContext,
  getBoxOverhead,
  getContentWidth,
  getTerminalWidth,
  type HorizontalLayoutOptions,
  joinHorizontal,
  joinVertical,
  resolveWidth,
  type VerticalLayoutOptions,
} from "./layout.js";
// List rendering
export {
  type ListItem,
  type ListOptions,
  type ListStyle,
  type NestedListItem,
  renderList,
} from "./list.js";
// Markdown rendering
export { renderMarkdown } from "./markdown.js";
// Progress rendering
export { type ProgressOptions, renderProgress } from "./progress.js";
// Separator rendering
export {
  type DividerStyle,
  renderSeparator,
  type SeparatorOptions,
} from "./separator.js";
// Shapes and unified render
export {
  type Collection,
  clearRenderers,
  type Hierarchy,
  isCollection,
  isHierarchy,
  isKeyValue,
  isPlainObject,
  isResource,
  type KeyValue,
  type RenderOptions,
  type Resource,
  registerRenderer,
  render,
  type Shape,
  type ShapeRenderer,
  type TreeNode,
  treeNodeToRecord,
  unregisterRenderer,
} from "./shapes.js";
// Spinner rendering
export {
  getSpinnerFrame,
  renderSpinner,
  SPINNERS,
  type SpinnerFrames,
  type SpinnerStyle,
} from "./spinner.js";
// Stack composition
export {
  type BoxifyOptions,
  boxify,
  createHStack,
  createVStack,
  DEFAULT_STACK_THEME,
  DELIMITERS,
  type DelimiterName,
  type DelimiterSet,
  getDelimiter,
  getMarker,
  type HStackOptions,
  hstack,
  type ItemState,
  isRenderable,
  type MarkerName,
  type Renderable,
  type StackBox,
  type StackInput,
  type StackItem,
  type StackTheme,
  unbox,
  type VStackMode,
  type VStackOptions,
  vstack,
  vstackItem,
} from "./stack.js";
// Table rendering
export { renderTable, type TableOptions } from "./table.js";
// Text formatting
export {
  ANSI_REGEX,
  getStringWidth,
  padText,
  pluralize,
  slugify,
  stripAnsi,
  truncateText,
  wrapText,
} from "./text.js";
// Tree rendering
export {
  renderTree,
  TREE_GUIDES,
  type TreeGuideStyle,
  type TreeOptions,
} from "./tree.js";
// Shared render types
export type { LayoutContext, WidthMode } from "./types.js";
