# Layout Context Spec

> Container-aware width for nested CLI components

**Status**: Draft (Reviewed)
**Authors**: Claude (with software-craft skill)
**Date**: 2026-01-29

## Problem Statement

When rendering components inside boxes, there's no way for nested components to know their available width:

```typescript
// Current: Manual calculation required
const box = createBox(
  renderProgress(0.5, { width: 30 }), // How do I know 30 is right?
  { width: 40, padding: 1 }
);

// Desired: Components adapt to container
const box = createBox(
  renderProgress(0.5, { width: "full" }), // Fills available space
  { width: 40, padding: 1 }
);
```

### Requirements

1. Components should be able to use `width: "full"` to fill container
2. Components should not exceed container bounds
3. Solution should work with existing functional API
4. Backward compatible - existing code must continue to work

## Research Summary

### External Library Patterns

| Library | Approach | Propagation | API Style |
|---------|----------|-------------|-----------|
| **Lipgloss** (Go) | Explicit calculation | None | Functional |
| **Ink** (React) | Yoga flexbox engine | Automatic | JSX/React |
| **FTXUI** (C++) | `flex` decorator | Through element tree | Functional |
| **CSS** | Container queries | Explicit containment | Declarative |

**Key Insight**: Libraries targeting static output (Lipgloss) use explicit calculation. Interactive TUIs (Ink, FTXUI) use layout engines for dynamic resize.

### Relevant to Our Use Case

`@outfitter/cli` generates **static output** (not interactive TUI). This aligns with Lipgloss's approach:
- Calculate dimensions before rendering
- No need for constraint solver
- Explicit is often clearer than magic

## Proposed Design

### Hybrid Approach: Explicit + Convenience

Combine the simplicity of explicit calculation with convenience helpers for common cases.

### Phase 1: Width Calculation Utilities (Explicit)

Add utilities to calculate available content width:

```typescript
/**
 * Calculate available content width inside a box.
 */
export function getContentWidth(options: BoxOptions): number;

/**
 * Calculate total overhead (borders + padding).
 */
export function getBoxOverhead(options: BoxOptions): { horizontal: number; vertical: number };
```

**Usage**:
```typescript
const boxOpts: BoxOptions = { width: 40, padding: 1, border: "single" };
const available = getContentWidth(boxOpts); // → 36

const progress = renderProgress(0.5, { width: available });
const box = createBox(progress, boxOpts);
```

**Pros**: Simple, explicit, no API changes, easy to understand
**Cons**: Manual calculation required each time

### Phase 2: Extended WidthMode (Convenience)

Extend `WidthMode` to support container-relative values:

```typescript
// Current
type WidthMode = "text" | "full" | number;

// Extended
type WidthMode = "text" | "full" | "container" | number | `${number}%`;
```

| Mode | Behavior |
|------|----------|
| `"text"` | Fit to text content |
| `"full"` | Terminal width (`process.stdout.columns`) |
| `"container"` | Available width from layout context |
| `number` | Fixed character width |
| `"50%"` | Percentage of container/terminal |

**Requires**: Layout context to resolve `"container"` and percentages.

### Phase 3: Optional Layout Context (Automatic)

For automatic propagation, introduce an optional context:

```typescript
interface LayoutContext {
  /** Available width in characters */
  width: number;
}

/**
 * Create a layout context from box options.
 */
function createLayoutContext(options: BoxOptions): LayoutContext;

/**
 * Resolve WidthMode to actual width given context.
 */
function resolveWidth(mode: WidthMode, ctx?: LayoutContext): number;
```

**Usage**:
```typescript
// Explicit context passing
const ctx = createLayoutContext({ width: 40, padding: 1 });
const progress = renderProgress(0.5, { width: "container" }, ctx);

// Or with createBox helper
const box = createBox([
  renderHeading("Status", { width: "container" }),
  renderProgress(0.5, { width: "container" }),
], { width: 40, padding: 1 });
```

**Implementation Options**:

1. **Explicit Context Argument** (recommended for start)
   - Add optional `ctx?: LayoutContext` to render functions
   - Clear, explicit, no magic

2. **Closure-based Context** (future consideration)
   - `withLayout(ctx, () => { ... })` captures context
   - Implicit but still explicit scope

3. **Global Context Stack** (not recommended)
   - Push/pop global context
   - Hidden state, hard to reason about

### Recommended Implementation Order

```
Phase 1: getContentWidth() utility        ← Ship first
    ↓
Phase 2: Extended WidthMode               ← Add convenience
    ↓
Phase 3: Optional LayoutContext           ← If explicit proves painful
```

## API Design

### Implementation Notes (Phase 1)

**Internal Function Handling**: `normalizePadding()` and `normalizeBorders()` are currently internal to `box.ts`. For Phase 1:
- Export these from `box.ts` (minimal API surface expansion)
- Re-export via `index.ts` for consistency

**Terminal Width Helper**: Add `getTerminalWidth()` to centralize the `process.stdout.columns ?? 80` fallback:

```typescript
export function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}
```

**Type Organization (Phase 2 prep)**: When Phase 2 arrives, `WidthMode` may migrate from `heading.ts` to `packages/cli/src/render/types.ts`, and `resolveWidth()` should live in `layout.ts` alongside width utilities.

### New Exports (Phase 1)

```typescript
// packages/cli/src/render/layout.ts

/**
 * Calculate available content width inside a box.
 * Accounts for borders and padding.
 */
export function getContentWidth(options: BoxOptions): number {
  const pad = normalizePadding(options.padding, 1);
  const borders = normalizeBorders(options.borders);

  const borderWidth = (borders.left ? 1 : 0) + (borders.right ? 1 : 0);
  const paddingWidth = pad.left + pad.right;
  const overhead = borderWidth + paddingWidth;

  if (options.width) {
    return options.width - overhead;
  }

  // No fixed width - return terminal width minus overhead
  return (process.stdout.columns ?? 80) - overhead;
}

/**
 * Get box overhead (borders + padding) for each axis.
 */
export function getBoxOverhead(options: BoxOptions): {
  horizontal: number;
  vertical: number;
} {
  const pad = normalizePadding(options.padding, 1);
  const borders = normalizeBorders(options.borders);

  return {
    horizontal:
      (borders.left ? 1 : 0) + (borders.right ? 1 : 0) + pad.left + pad.right,
    vertical:
      (borders.top ? 1 : 0) + (borders.bottom ? 1 : 0) + pad.top + pad.bottom,
  };
}
```

### Extended WidthMode (Phase 2)

```typescript
// packages/cli/src/render/heading.ts

/**
 * Width specification for components.
 */
export type WidthMode =
  | "text"       // Fit to text content
  | "full"       // Terminal width
  | "container"  // Available container width (requires context)
  | number       // Fixed character width
  | `${number}%` // Percentage of container/terminal

/**
 * Resolve width mode to actual character width.
 */
export function resolveWidth(
  mode: WidthMode,
  ctx?: LayoutContext
): number {
  if (typeof mode === "number") return mode;

  if (mode === "full") {
    return process.stdout.columns ?? 80;
  }

  if (mode === "container") {
    if (!ctx) throw new Error("WidthMode 'container' requires LayoutContext");
    return ctx.width;
  }

  if (mode.endsWith("%")) {
    const percent = parseInt(mode, 10) / 100;
    const base = ctx?.width ?? process.stdout.columns ?? 80;
    return Math.floor(base * percent);
  }

  // "text" mode - return 0, let component calculate from content
  return 0;
}
```

### Layout Context (Phase 3)

```typescript
// packages/cli/src/render/context.ts

export interface LayoutContext {
  /** Available width in characters */
  readonly width: number;
  /** Parent context (for nested boxes) */
  readonly parent?: LayoutContext;
  // Note: height deferred to future phase when vertical constraints needed
}

/**
 * Create layout context from box options.
 */
export function createLayoutContext(
  options: BoxOptions,
  parent?: LayoutContext
): LayoutContext {
  const contentWidth = getContentWidth(options);

  return {
    width: contentWidth,
    parent,
  };
}
```

## Migration Path

### Existing Code (No Changes Required)

```typescript
// This continues to work exactly as before
const box = renderBox("Content", { width: 40 });
const progress = renderProgress(0.5, { width: 20 });
```

### New Explicit Style (Phase 1)

```typescript
// Calculate available width explicitly
const boxOpts = { width: 40, padding: 1 };
const available = getContentWidth(boxOpts);

const box = createBox(
  renderProgress(0.5, { width: available }),
  boxOpts
);
```

### Container-Relative Style (Phase 2+)

```typescript
// Use "container" mode with context
const ctx = createLayoutContext({ width: 40, padding: 1 });

const box = createBox([
  renderHeading("Status", { width: "container" }, ctx),
  renderProgress(0.5, { width: "container" }, ctx),
], { width: 40, padding: 1 });
```

## Trade-offs

### Explicit Calculation (Phase 1)

| Pro | Con |
|-----|-----|
| Simple to understand | Repetitive calculation |
| No API changes | Easy to forget |
| Backward compatible | Can still exceed bounds |
| Easy to debug | Boilerplate |

### Layout Context (Phase 3)

| Pro | Con |
|-----|-----|
| Automatic propagation | New concept to learn |
| Can't exceed bounds | Requires passing context |
| DRY - calculate once | More complex API |
| Enables "container" mode | Harder to debug |

## Decision

**Recommended**: Start with Phase 1 (explicit utilities), evaluate need for Phase 2-3 based on real usage.

**Rationale**:
1. Follows "simplest thing that works" principle
2. No breaking changes
3. Can add context later if explicit proves painful
4. Matches Lipgloss (proven approach for static CLI output)

## Open Questions

1. Should `createBox` automatically create a context for nested content?
2. Should components validate width against container and warn/clamp?
3. Should we support height constraints too, or width-only for now?
4. How should tables handle container width (sum of columns)?
   - *Note*: Tables may remain explicit-only since their width model (sum of columns) differs from single-value components. Phase 2-3 may offer a `getTableContentWidth()` helper but not automatic context propagation.
5. Should `ProgressOptions.width` accept `WidthMode` (breaking change) or remain `number` (explicit calculation only)?
   - *Note*: This affects whether Phase 2's convenience features reduce boilerplate for the motivating example.

## References

- [Lip Gloss](https://github.com/charmbracelet/lipgloss) - Go terminal styling
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [FTXUI](https://github.com/ArthurSonzogni/FTXUI) - C++ functional TUI
- [CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
