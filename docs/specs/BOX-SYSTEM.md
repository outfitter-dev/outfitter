# Box System Spec

> Composable box/container rendering for `@outfitter/cli`

**Status**: Proposal  
**Authors**: Research by Claude (analyst agent)  
**Date**: 2026-01-29

## Executive Summary

This spec defines an enhanced box system for `@outfitter/cli` that adds internal dividers, nested boxes, and flexible layout composition while maintaining simplicity for static CLI output.

## Research Summary

Four TUI libraries were analyzed for their box/container rendering approaches:

| Library | Language | Layout Model | Key Pattern |
|---------|----------|--------------|-------------|
| [Lip Gloss](https://github.com/charmbracelet/lipgloss) | Go | Join functions | `JoinHorizontal`/`JoinVertical` with alignment |
| [Ratatui](https://github.com/ratatui/ratatui) | Rust | Constraint-based | Layout splits with Min/Max/Ratio/Percentage |
| [React Ink](https://github.com/vadimdemedes/ink) | JS | Flexbox (Yoga) | CSS-like properties on Box components |
| [OpenTUI](https://opentui.com/) | TS | Flexbox (Yoga) | `BoxRenderable` with border/padding options |

### Key Insights

**Common patterns across all libraries:**
1. **Separation of concerns**: Content rendering vs. layout composition
2. **Alignment control**: Vertical alignment for horizontal joins, horizontal for vertical
3. **Border customization**: Individual side control, multiple style presets
4. **Padding vs. margin**: Internal vs. external spacing distinction

**Divergent approaches:**
- Lip Gloss: Functional composition with `Join*` functions (closest to our current approach)
- Ratatui: Constraint solver for complex responsive layouts
- Ink/OpenTUI: Full flexbox model with Yoga engine

**Our constraint**: Static CLI output means we do not need:
- Interactive focus management
- Dynamic constraint solving
- Full flexbox (overkill for static output)
- Canvas/layer positioning

## Current State

`@outfitter/cli` currently provides:

```typescript
// Box rendering
renderBox(content: string | string[], options?: BoxOptions): string
// Options: border, padding, width, title, align

// Layout composition
joinHorizontal(blocks: string[], options?: HorizontalLayoutOptions): string
joinVertical(blocks: string[], options?: VerticalLayoutOptions): string

// Separators (standalone)
renderSeparator(options?: SeparatorOptions): string
```

**What is missing:**
1. Internal dividers within a box
2. Nested box composition (box-in-box)
3. Individual border side control
4. Margin (external spacing)
5. Border merging when boxes touch

## Proposed API

### Phase 1: Internal Dividers

Add divider support within boxes using T-intersection characters.

```typescript
interface BoxOptions {
  // ... existing options ...
  
  /**
   * Content sections separated by internal dividers.
   * When provided, content is rendered in sections with horizontal dividers.
   */
  sections?: Array<string | string[]>;
}

// Usage
renderBox({
  sections: [
    "Header content",
    ["Line 1", "Line 2"],
    "Footer content"
  ],
  border: "single"
});

// Output:
// ┌─────────────────┐
// │ Header content  │
// ├─────────────────┤
// │ Line 1          │
// │ Line 2          │
// ├─────────────────┤
// │ Footer content  │
// └─────────────────┘
```

**Implementation notes:**
- Uses existing `leftT` and `rightT` from `BorderCharacters`
- Respects current padding settings
- Sections array takes precedence over `content` parameter when provided

### Phase 2: Enhanced Border Control

Add individual border side control and margin support.

```typescript
interface BoxOptions {
  // ... existing options ...
  
  /**
   * External margin (spacing outside the box).
   * Single number applies to all sides.
   */
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  
  /**
   * Enhanced padding with individual side control.
   */
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  
  /**
   * Control which borders to render.
   * @default { top: true, right: true, bottom: true, left: true }
   */
  borders?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

// Usage: Box with only top and bottom borders
renderBox("Content", {
  borders: { top: true, bottom: true, left: false, right: false }
});

// Output:
// ─────────────
//  Content
// ─────────────
```

### Phase 3: Nested Boxes

Add explicit nesting support with proper border character handling.

```typescript
/**
 * Content that can be rendered inside a box.
 * - string: Plain text content
 * - string[]: Multi-line content
 * - Box: Nested box (rendered string with metadata)
 */
type BoxContent = string | string[] | Box;

interface Box {
  /** Rendered string representation */
  readonly output: string;
  /** Width in characters */
  readonly width: number;
  /** Height in lines */
  readonly height: number;
}

/**
 * Creates a Box object that can be composed with other boxes.
 */
function createBox(content: BoxContent | BoxContent[], options?: BoxOptions): Box;

/**
 * Convenience function that returns a string (current behavior).
 */
function renderBox(content: string | string[], options?: BoxOptions): string;

// Usage: Nested boxes
const inner = createBox("Inner content", { border: "rounded" });
const outer = createBox(inner, { border: "double", title: "Container" });
console.log(outer.output);

// Output:
// ╔═ Container ═══════════════╗
// ║ ╭───────────────────────╮ ║
// ║ │ Inner content         │ ║
// ║ ╰───────────────────────╯ ║
// ╚═══════════════════════════╝
```

### Phase 4: Layout Composition Enhancements

Enhance existing layout functions with border-aware joining.

```typescript
interface HorizontalLayoutOptions {
  gap?: number;
  align?: "top" | "center" | "bottom";
  
  /**
   * When true, merge adjacent borders into single lines.
   * Requires boxes with compatible border styles.
   * @default false
   */
  mergeBorders?: boolean;
}

// Usage: Side-by-side boxes with merged borders
const left = createBox("Left", { border: "single" });
const right = createBox("Right", { border: "single" });

joinHorizontal([left.output, right.output], { mergeBorders: true });

// Without mergeBorders:
// ┌──────┐ ┌───────┐
// │ Left │ │ Right │
// └──────┘ └───────┘

// With mergeBorders:
// ┌──────┬───────┐
// │ Left │ Right │
// └──────┴───────┘
```

**Implementation notes:**
- Border merging uses existing `topT`, `bottomT`, and `cross` characters
- Only works when both boxes have compatible border styles
- Falls back to gap-based layout for incompatible styles

### Phase 5: Flex-like Sizing (Future)

Add proportional sizing for layout composition.

```typescript
interface BoxOptions {
  // ... existing options ...
  
  /**
   * Flex grow factor for proportional sizing in layouts.
   * @default 0
   */
  flex?: number;
  
  /**
   * Minimum width constraint.
   */
  minWidth?: number;
  
  /**
   * Maximum width constraint.
   */
  maxWidth?: number;
}

interface HorizontalLayoutOptions {
  // ... existing options ...
  
  /**
   * Total width for the layout.
   * When set, boxes with flex values will share remaining space.
   */
  width?: number;
}

// Usage: Two boxes sharing space 1:2
const narrow = createBox("Narrow", { flex: 1 });
const wide = createBox("Wide content here", { flex: 2 });

joinHorizontal([narrow.output, wide.output], { width: 60 });
// narrow gets ~20 chars, wide gets ~40 chars
```

## API Pattern Comparison

### Options Object (Current/Proposed)

```typescript
// Current pattern - simple, discoverable
renderBox("Content", {
  border: "rounded",
  padding: 1,
  title: "Header"
});
```

**Pros:**
- Familiar to TypeScript developers
- Good IDE autocomplete
- Easy to extend

**Cons:**
- Verbose for simple cases
- All options mixed together

### Builder Pattern (Lip Gloss Style)

```typescript
// Alternative - not proposed
Box.new()
  .border("rounded")
  .padding(1)
  .title("Header")
  .render("Content");
```

**Pros:**
- Chainable, readable
- Clear separation of configuration and rendering

**Cons:**
- More complex implementation
- Unfamiliar to some developers
- Harder to type correctly

**Decision:** Keep options object pattern for consistency with existing API.

## Border Character Reference

Current `BorderCharacters` interface supports all needed characters:

```typescript
interface BorderCharacters {
  topLeft: string;      // ┌ ╔ ╭ ┏
  topRight: string;     // ┐ ╗ ╮ ┓
  bottomLeft: string;   // └ ╚ ╰ ┗
  bottomRight: string;  // ┘ ╝ ╯ ┛
  horizontal: string;   // ─ ═ ━
  vertical: string;     // │ ║ ┃
  topT: string;         // ┬ ╦ ┳ (for border merging)
  bottomT: string;      // ┴ ╩ ┻ (for border merging)
  leftT: string;        // ├ ╠ ┣ (for internal dividers)
  rightT: string;       // ┤ ╣ ┫ (for internal dividers)
  cross: string;        // ┼ ╬ ╋ (for grid intersections)
}
```

## Implementation Phases

| Phase | Feature | Priority | Complexity | Dependencies |
|-------|---------|----------|------------|--------------|
| 1 | Internal dividers | High | Low | None |
| 2 | Individual borders, margin | Medium | Low | None |
| 3 | Nested boxes | Medium | Medium | Phase 2 |
| 4 | Border merging | Low | Medium | Phase 3 |
| 5 | Flex sizing | Low | High | Phase 3 |

**Recommendation:** Implement Phases 1-3 for the initial release. Phases 4-5 can be deferred based on user feedback.

## Examples

### Status Panel with Sections

```typescript
const status = renderBox({
  sections: [
    "System Status",
    [
      "CPU:    45%",
      "Memory: 2.1 GB / 8 GB",
      "Disk:   120 GB free"
    ],
    "Last updated: 2 minutes ago"
  ],
  border: "rounded",
  width: 30
});

// Output:
// ╭────────────────────────────╮
// │ System Status              │
// ├────────────────────────────┤
// │ CPU:    45%                │
// │ Memory: 2.1 GB / 8 GB      │
// │ Disk:   120 GB free        │
// ├────────────────────────────┤
// │ Last updated: 2 minutes ago│
// ╰────────────────────────────╯
```

### Dashboard Layout

```typescript
const header = createBox("Dashboard", { 
  border: "heavy",
  align: "center",
  width: 60
});

const sidebar = createBox({
  sections: ["Navigation", ["Home", "Settings", "Help"]]
}, { border: "single", width: 15 });

const main = createBox("Main content area", { 
  border: "single",
  flex: 1 
});

const layout = joinVertical([
  header.output,
  joinHorizontal([sidebar.output, main.output], { gap: 1 })
]);
```

### Help Command Output

```typescript
const usage = renderBox([
  "outfitter <command> [options]",
  "",
  "Commands:",
  "  init     Initialize a new project",
  "  build    Build the project",
  "  serve    Start development server"
], {
  title: "Usage",
  border: "rounded",
  padding: 1
});
```

## Trade-offs

### What We Are Intentionally NOT Doing

1. **Full flexbox implementation**
   - Why not: Overkill for static CLI output
   - Alternative: Simple flex grow factor for proportional sizing

2. **Constraint solver (Cassowary)**
   - Why not: Adds significant complexity
   - Alternative: Min/max constraints with explicit widths

3. **Interactive focus management**
   - Why not: Out of scope for static rendering
   - Alternative: Separate interactive rendering layer if needed

4. **Canvas/layer positioning**
   - Why not: Designed for real-time TUIs
   - Alternative: Explicit layout composition

5. **Automatic border style matching**
   - Why not: Implicit behavior can be surprising
   - Alternative: Explicit `mergeBorders` option

### Compatibility Considerations

- `renderBox()` signature remains backward compatible
- New `createBox()` function for advanced composition
- Existing `joinHorizontal`/`joinVertical` enhanced with optional features

## Open Questions

1. **Section titles**: Should sections within a box support individual titles?
   ```typescript
   sections: [
     { title: "Header", content: "..." },
     { content: ["Line 1", "Line 2"] }
   ]
   ```

2. **Border color per-side**: Worth the complexity?
   ```typescript
   borderColor: {
     top: "red",
     right: "blue",
     // ...
   }
   ```

3. **Auto-width detection**: Should nested boxes auto-size to parent?

## Sources

- [Lip Gloss GitHub](https://github.com/charmbracelet/lipgloss) - Style definitions for nice terminal layouts
- [Lip Gloss v2 API](https://pkg.go.dev/github.com/charmbracelet/lipgloss/v2) - Border struct, Join functions, Place API
- [Ratatui](https://github.com/ratatui/ratatui) - Rust TUI library
- [Ratatui Layout Concepts](https://ratatui.rs/concepts/layout/) - Constraint-based layout system
- [Ratatui Block Widget](https://ratatui.rs/recipes/widgets/block/) - Block widget recipes
- [React Ink](https://github.com/vadimdemedes/ink) - React for interactive command-line apps
- [OpenTUI](https://opentui.com/) - Terminal UIs in TypeScript
- [OpenTUI Basic Components](https://deepwiki.com/sst/opentui/4.1-basic-components) - BoxRenderable API details
