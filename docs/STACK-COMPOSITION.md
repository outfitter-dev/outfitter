# Stack Composition System

Composable horizontal and vertical layout primitives for CLI output with configurable delimiters, display modes, and semantic formatting.

## Overview

The stack composition system provides building blocks for creating complex CLI layouts:

- **`hstack`** — Join items horizontally with delimiters
- **`vstack`** — Stack items vertically with display modes (guide, tree, boxed, etc.)
- **`boxify`** / **`unbox`** — Convert between boxes and raw strings
- **`Renderable`** — Shared interface enabling seamless composition

All primitives return composable types that work together without manual string extraction.

```typescript
import {
  hstack, vstack, vstackItem,
  createHStack, createVStack,
  boxify, unbox,
  DELIMITERS, DEFAULT_STACK_THEME,
} from "@outfitter/cli/render/stack";
```

---

## Quick Start

### Horizontal Stack

Join items side-by-side with delimiters:

```typescript
// Simple delimiter
hstack(["a", "b", "c"], { delimiter: "bullet", gap: 1 });
// → "a • b • c"

// Breadcrumb path
hstack(["src", "components", "Button.tsx"], { delimiter: "arrow" });
// → "src→components→Button.tsx"

// Custom delimiter
hstack(["Home", "Products", "Widget"], { delimiter: " / " });
// → "Home / Products / Widget"
```

### Vertical Stack

Stack items with visual guides and markers:

```typescript
const items = [
  vstackItem("feature/auth", ["PR #190 (Draft)"], { state: "current" }),
  vstackItem("feature/api", ["PR #189"]),
];

vstack(items, { mode: "guide" });
// → ◉ feature/auth
//   │ PR #190 (Draft)
//   │
//   ○ feature/api
//   │ PR #189
```

### Boxify and Compose

Wrap stacks in boxes, then compose them:

```typescript
const stack = createVStack(items, { mode: "guide" });
const boxed = boxify(stack, { title: "Branches", border: "rounded" });
console.log(boxed.output);
// → ╭─ Branches ─────────╮
//   │ ◉ feature/auth     │
//   │ │ PR #190 (Draft)  │
//   │ │                  │
//   │ ○ feature/api      │
//   │ │ PR #189          │
//   ╰────────────────────╯

// Side-by-side boxes
hstack([boxify(stack1), boxify(stack2)], { gap: 2 });
```

---

## Horizontal Stack (`hstack`)

### Signature

```typescript
function hstack(
  items: Array<StackInput>,
  options?: HStackOptions
): string;

function createHStack(
  items: Array<StackInput>,
  options?: HStackOptions
): StackBox;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `DelimiterName \| string` | `"space"` | Delimiter between items |
| `gap` | `number` | `0` | Spaces around delimiter |
| `align` | `"top" \| "center" \| "bottom"` | `"top"` | Vertical alignment for multi-line items |

### Delimiters

Named delimiters with unicode and ASCII fallbacks:

| Name | Unicode | Fallback |
|------|---------|----------|
| `space` | ` ` | ` ` |
| `bullet` | `•` | `*` |
| `dot` | `·` | `.` |
| `pipe` | `│` | `\|` |
| `arrow` | `→` | `->` |
| `slash` | `/` | `/` |
| `colon` | `:` | `:` |

### Examples

**With gap spacing:**

```typescript
hstack(["main", "Draft", "2 hours ago"], { delimiter: "bullet", gap: 1 });
// → "main • Draft • 2 hours ago"
```

**Multi-line with alignment:**

```typescript
hstack(["Line1\nLine2\nLine3", "Single"], { delimiter: "pipe", align: "center" });
// → Line1│
//   Line2│Single
//   Line3│
```

**With Renderables:**

```typescript
const box1 = createBox("Left", { border: "single" });
const box2 = createBox("Right", { border: "single" });
hstack([box1, box2], { gap: 2 });
// → ┌──────┐  ┌───────┐
//   │ Left │  │ Right │
//   └──────┘  └───────┘
```

---

## Vertical Stack (`vstack`)

### Signature

```typescript
function vstack(
  items: Array<StackInput>,
  options?: VStackOptions
): string;

function createVStack(
  items: Array<StackInput>,
  options?: VStackOptions
): StackBox;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `VStackMode` | `"guide"` | Display mode |
| `gap` | `number` | `0` | Blank lines between items |
| `theme` | `Partial<StackTheme>` | `DEFAULT_STACK_THEME` | Marker/delimiter theme |
| `guide` | `TreeGuideStyle` | `"single"` | Guide line style |

### Display Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `plain` | Simple newlines, no guides | Basic lists |
| `guide` | Vertical guide (`│`) with markers | Branch stacks, progress flows |
| `tree` | Tree connectors (`├`/`└`) | Hierarchies, git log style |
| `boxed` | Each item in a bordered box | Emphasized sections |
| `compact` | Single line per item | Dense lists |

### Mode Examples

**Plain mode:**

```typescript
vstack(["Item 1", "Item 2", "Item 3"], { mode: "plain" });
// → Item 1
//   Item 2
//   Item 3
```

**Guide mode (default):**

```typescript
vstack([
  vstackItem("Header 1", ["Body line 1", "Body line 2"]),
  vstackItem("Header 2", ["Body line"]),
], { mode: "guide" });
// → ○ Header 1
//   │ Body line 1
//   │ Body line 2
//   │
//   ○ Header 2
//   │ Body line
```

**Tree mode:**

```typescript
vstack([
  vstackItem("First", ["Body 1"]),
  vstackItem("Last", ["Body 2"]),
], { mode: "tree" });
// → ├── First
//   │   Body 1
//   └── Last
//       Body 2
```

**Boxed mode:**

```typescript
vstack(["Item 1", "Item 2"], { mode: "boxed" });
// → ┌─────────┐
//   │ Item 1  │
//   └─────────┘
//   ┌─────────┐
//   │ Item 2  │
//   └─────────┘
```

**Compact mode:**

```typescript
const items = [
  vstackItem("feature/auth", ["PR #190"], {
    state: "current",
    compact: "feature/auth • Draft • 2h ago"
  }),
  vstackItem("feature/api", ["PR #189"], {
    compact: "feature/api • 1d ago"
  }),
];
vstack(items, { mode: "compact" });
// → ◉ feature/auth • Draft • 2h ago
//   ○ feature/api • 1d ago
```

---

## Stack Items (`vstackItem`)

### Signature

```typescript
function vstackItem(
  header: string,
  body?: string[],
  options?: {
    state?: ItemState;
    marker?: MarkerName | string;
    compact?: string;
    style?: (s: string) => string;
  }
): StackItem;
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `state` | `ItemState` | Semantic state for theme-based markers |
| `marker` | `MarkerName \| string` | Explicit marker (overrides theme) |
| `compact` | `string` | Single-line representation for compact mode |
| `style` | `(s: string) => string` | Styling function applied to content |

### Semantic States

States map to markers via the theme:

| State | Default Marker | Unicode |
|-------|----------------|---------|
| `default` | `circleOutline` | `○` |
| `current` | `circleDot` | `◉` |
| `focused` | `pointer` | `❯` |
| `checked` | `checkboxChecked` | `☑` |
| `disabled` | `dash` | `–` |

### Custom Theme

Override the default marker mapping:

```typescript
const todoTheme = {
  markers: {
    default: "checkbox",        // ☐
    checked: "checkboxChecked", // ☑
    current: "pointer",         // ❯
    focused: "pointer",
    disabled: "dash",
  },
};

vstack([
  vstackItem("Buy groceries", [], { state: "checked" }),
  vstackItem("Write code", [], { state: "current" }),
  vstackItem("Review PR"),
], { mode: "plain", theme: todoTheme });
// → ☑ Buy groceries
//   ❯ Write code
//   ☐ Review PR
```

### Guide Styles

Different vertical guide characters:

```typescript
vstack(items, { mode: "guide", guide: "single" });  // │
vstack(items, { mode: "guide", guide: "heavy" });   // ┃
vstack(items, { mode: "guide", guide: "double" });  // ║
vstack(items, { mode: "guide", guide: "rounded" }); // │ (same as single)
```

---

## Box Integration

### The `Renderable` Interface

Both `Box` and `StackBox` satisfy the same interface:

```typescript
interface Renderable {
  readonly output: string;  // Rendered content
  readonly width: number;   // Character width
  readonly height: number;  // Line count
}
```

This enables seamless composition—boxes and stacks are interchangeable.

### `boxify(content, options?)`

Wrap any content in a box:

```typescript
function boxify(
  content: Renderable | string | string[],
  options?: BoxifyOptions
): Renderable;
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | `string` | — | Box title |
| `border` | `"single" \| "double" \| "rounded" \| "heavy" \| "none"` | `"single"` | Border style |
| `padding` | `number` | — | Internal padding |

**Examples:**

```typescript
// Boxify a stack
const stack = createVStack([...], { mode: "guide" });
const boxed = boxify(stack, { title: "Branches", border: "rounded" });

// Boxify plain text
boxify("Hello World", { border: "double" });

// Compose boxified elements
hstack([
  boxify("Panel A", { border: "rounded" }),
  boxify("Panel B", { border: "rounded" }),
], { gap: 1 });
// → ╭─────────╮ ╭─────────╮
//   │ Panel A │ │ Panel B │
//   ╰─────────╯ ╰─────────╯
```

### `unbox(content)`

Extract the raw string from a Renderable:

```typescript
function unbox(content: Renderable | string): string;
```

**Examples:**

```typescript
const stack = createVStack(["A", "B"], { mode: "plain" });
const raw = unbox(stack);  // "A\nB"

// Pass-through for strings
unbox("already a string");  // "already a string"
```

### `isRenderable(value)`

Type guard for checking Renderable objects:

```typescript
function isRenderable(value: unknown): value is Renderable;
```

---

## Composition Patterns

### Grid Layout

```typescript
const col1 = createVStack(["A1", "A2", "A3"], { mode: "plain" });
const col2 = createVStack(["B1", "B2", "B3"], { mode: "plain" });
const col3 = createVStack(["C1", "C2", "C3"], { mode: "plain" });

hstack([col1, col2, col3], { delimiter: "pipe", gap: 1 });
// → A1 │ B1 │ C1
//   A2 │ B2 │ C2
//   A3 │ B3 │ C3
```

### Nested Boxes

```typescript
const inner = createVStack(items, { mode: "guide" });
const outer = boxify(inner, { title: "Inner Stack", border: "rounded" });
const final = boxify(outer, { title: "Outer", border: "double" });
```

### Dashboard Layout

```typescript
const left = boxify(
  createVStack(["Users", "─────", "Alice", "Bob"], { mode: "plain" }),
  { border: "single" }
);
const right = boxify(
  createVStack(["Roles", "─────", "Admin", "User"], { mode: "plain" }),
  { border: "single" }
);

hstack([left, right], { gap: 2 });
// → ┌───────┐  ┌───────┐
//   │ Users │  │ Roles │
//   │ ───── │  │ ───── │
//   │ Alice │  │ Admin │
//   │ Bob   │  │ User  │
//   └───────┘  └───────┘
```

### Branch Stack (gt log style)

```typescript
const branches = [
  vstackItem("feature/auth (current)", [
    "PR #190 (Draft)",
    "https://github.com/..."
  ], { state: "current" }),
  vstackItem("feature/api", [
    "PR #189"
  ]),
  vstackItem("main", [], { state: "disabled" }),
];

const stack = createVStack(branches, { mode: "guide" });
const boxed = boxify(stack, { title: "Branch Stack", border: "rounded" });
console.log(boxed.output);
```

---

## API Reference

### Types

| Type | Description |
|------|-------------|
| `StackInput` | `string \| StackItem \| Renderable` — Input to stack functions |
| `StackItem` | Item with content, state, marker, compact, style |
| `StackBox` | Alias for `Renderable` — returned by create functions |
| `Renderable` | `{ output, width, height }` — composable block |
| `VStackMode` | `"plain" \| "guide" \| "tree" \| "boxed" \| "compact"` |
| `ItemState` | `"default" \| "current" \| "focused" \| "checked" \| "disabled"` |
| `MarkerName` | Known marker names from INDICATORS |
| `DelimiterName` | `"space" \| "bullet" \| "dot" \| "pipe" \| "arrow" \| "slash" \| "colon"` |
| `StackTheme` | Theme configuration with markers, delimiter, guide |
| `HStackOptions` | Options for horizontal stack |
| `VStackOptions` | Options for vertical stack |
| `BoxifyOptions` | Options for boxify helper |

### Constants

| Constant | Description |
|----------|-------------|
| `DELIMITERS` | Registry of delimiters with unicode/fallback |
| `DEFAULT_STACK_THEME` | Default theme for marker resolution |

### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `hstack(items, options?)` | `string` | Join items horizontally |
| `createHStack(items, options?)` | `StackBox` | Create composable horizontal stack |
| `vstack(items, options?)` | `string` | Stack items vertically |
| `createVStack(items, options?)` | `StackBox` | Create composable vertical stack |
| `vstackItem(header, body?, options?)` | `StackItem` | Create a stack item |
| `boxify(content, options?)` | `Renderable` | Wrap content in a box |
| `unbox(content)` | `string` | Extract raw string |
| `getDelimiter(name, forceUnicode?)` | `string` | Get delimiter character |
| `getMarker(name, forceUnicode?)` | `string` | Get marker character |
| `isRenderable(value)` | `boolean` | Type guard for Renderable |

---

## Related Documentation

- [Box Rendering](../packages/cli/src/render/box.ts) — Box primitives and options
- [PATTERNS.md](./PATTERNS.md) — Handler patterns and conventions
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Package structure and dependencies
