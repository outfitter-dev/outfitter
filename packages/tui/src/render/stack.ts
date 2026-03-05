/**
 * Stack composition system for CLI output.
 *
 * Provides composable horizontal and vertical stack primitives with configurable
 * delimiters, display modes, and semantic formatting.
 *
 * @packageDocumentation
 */

// Stack conversion helpers
export {
  boxify,
  type BoxifyOptions,
  unbox,
} from "./internal/stack-conversion.js";

// Horizontal stack
export { createHStack, hstack } from "./internal/hstack.js";

// Stack helpers (internal, but re-exported for barrel completeness)
// No public helpers to re-export

// Stack types, delimiter registry, marker names
export {
  DEFAULT_STACK_THEME,
  DELIMITERS,
  type DelimiterName,
  type DelimiterSet,
  getDelimiter,
  getMarker,
  type HStackOptions,
  isRenderable,
  type ItemState,
  type MarkerName,
  type Renderable,
  type StackBox,
  type StackInput,
  type StackItem,
  type StackTheme,
  type VStackMode,
  type VStackOptions,
} from "./internal/stack-types.js";

// Vertical stack
export { createVStack, vstack, vstackItem } from "./internal/vstack.js";
