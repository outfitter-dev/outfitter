/**
 * Render module.
 *
 * Re-exports all rendering utilities for terminal output.
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
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
  type BoxAlign,
  type BoxBorders,
  type BoxOptions,
  type BoxSpacing,
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
  renderHeading,
  type SeparatorStyle,
  type WidthMode,
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
  type HorizontalLayoutOptions,
  joinHorizontal,
  joinVertical,
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
