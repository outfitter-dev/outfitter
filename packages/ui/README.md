# @outfitter/ui

Color tokens, output shapes, and terminal renderers for consistent CLI output.

## Installation

```bash
bun add @outfitter/ui
```

## Quick Start

```typescript
import {
  createTheme,
  renderTable,
  renderTree,
  renderProgress,
  supportsColor,
} from "@outfitter/ui";

// Create theme with semantic colors
const theme = createTheme();
console.log(theme.success("Operation completed!"));
console.log(theme.error("Something went wrong"));

// Render a table
const data = [
  { name: "Alice", role: "Admin", status: "Active" },
  { name: "Bob", role: "User", status: "Pending" },
];
console.log(renderTable(data));

// Render progress
console.log(renderProgress({ current: 75, total: 100, showPercent: true }));
```

## Color Token System

The theme provides semantic and text color functions that wrap text in ANSI escape codes when colors are supported.

### Semantic Colors

| Token     | Color  | Use For            |
| --------- | ------ | ------------------ |
| `success` | Green  | Success messages   |
| `warning` | Yellow | Warnings           |
| `error`   | Red    | Errors             |
| `info`    | Blue   | Informational text |

### Text Colors

| Token       | Style   | Use For            |
| ----------- | ------- | ------------------ |
| `primary`   | Default | Primary text       |
| `secondary` | Gray    | Secondary text     |
| `muted`     | Dim     | De-emphasized text |

### Usage

```typescript
import { createTheme } from "@outfitter/ui";

const theme = createTheme();

console.log(theme.success("Done!"));       // Green
console.log(theme.error("Failed!"));       // Red
console.log(theme.warning("Caution"));     // Yellow
console.log(theme.info("Note"));           // Blue
console.log(theme.muted("(optional)"));    // Dim
```

### Direct Color Application

```typescript
import { applyColor } from "@outfitter/ui";

// Apply named colors directly
console.log(applyColor("Hello", "green"));
console.log(applyColor("Warning", "yellow"));
console.log(applyColor("Error", "red"));
```

Available color names: `green`, `yellow`, `red`, `blue`, `cyan`, `magenta`, `white`, `gray`.

## Environment Respect

The color system respects standard environment variables and terminal capabilities:

| Variable      | Behavior                                  |
| ------------- | ----------------------------------------- |
| `NO_COLOR`    | Disables all colors (per no-color.org)    |
| `FORCE_COLOR` | Enables colors even without TTY           |
| (neither)     | Falls back to TTY detection               |

```typescript
import { supportsColor, createTheme } from "@outfitter/ui";

if (supportsColor()) {
  const theme = createTheme();
  console.log(theme.success("Colored output"));
} else {
  console.log("Plain output");
}
```

### Priority Order

1. `NO_COLOR` takes highest priority - if set and non-empty, colors are disabled
2. `FORCE_COLOR` enables colors if `NO_COLOR` is not set
3. Falls back to checking `process.stdout.isTTY`

## Output Shapes

### Table

Renders data as an ASCII table with borders. Automatically calculates column widths based on content.

```typescript
import { renderTable } from "@outfitter/ui";

const data = [
  { id: 1, name: "Alice", status: "Active" },
  { id: 2, name: "Bob", status: "Inactive" },
];

console.log(renderTable(data));
// +----+-------+----------+
// | id | name  | status   |
// +----+-------+----------+
// | 1  | Alice | Active   |
// | 2  | Bob   | Inactive |
// +----+-------+----------+

// With custom headers and column widths
console.log(
  renderTable(data, {
    headers: { id: "ID", name: "Name" },
    columnWidths: { status: 10 },
  })
);
```

### List

Renders items as a bullet list with optional nesting.

```typescript
import { renderList } from "@outfitter/ui";

// Simple list
console.log(renderList(["First item", "Second item", "Third item"]));
// - First item
// - Second item
// - Third item

// Nested list
console.log(
  renderList([
    "Parent item",
    { text: "Item with children", children: ["Child 1", "Child 2"] },
  ])
);
// - Parent item
// - Item with children
//   - Child 1
//   - Child 2
```

### Tree

Renders hierarchical data as a tree with unicode box characters.

```typescript
import { renderTree } from "@outfitter/ui";

const tree = {
  src: {
    components: {
      Button: null,
      Input: null,
    },
    utils: {
      helpers: null,
    },
  },
  tests: null,
};

console.log(renderTree(tree));
// ├── src
// │   ├── components
// │   │   ├── Button
// │   │   └── Input
// │   └── utils
// │       └── helpers
// └── tests
```

### Progress

Renders a progress bar with optional percentage display.

```typescript
import { renderProgress } from "@outfitter/ui";

console.log(renderProgress({ current: 50, total: 100 }));
// [██████████░░░░░░░░░░]

console.log(renderProgress({ current: 75, total: 100, showPercent: true }));
// [███████████████░░░░░] 75%

console.log(renderProgress({ current: 30, total: 100, width: 10 }));
// [███░░░░░░░]
```

## Text Formatting

### Wrap Text

Word wraps text at a specified width, preserving ANSI codes across line breaks.

```typescript
import { wrapText } from "@outfitter/ui";

const long = "This is a long sentence that should be wrapped";
console.log(wrapText(long, 20));
// This is a long
// sentence that
// should be wrapped
```

### Truncate Text

Truncates text with ellipsis, respecting ANSI codes in width calculation.

```typescript
import { truncateText } from "@outfitter/ui";

console.log(truncateText("Hello World", 8));  // "Hello..."
console.log(truncateText("Short", 10));       // "Short" (no change)
```

### Pad Text

Pads text to a specified width, handling ANSI codes correctly.

```typescript
import { padText } from "@outfitter/ui";

console.log(padText("Hi", 10));  // "Hi        "
```

### Strip ANSI

Removes ANSI escape codes from text.

```typescript
import { stripAnsi } from "@outfitter/ui";

console.log(stripAnsi("\x1b[32mGreen\x1b[0m"));  // "Green"
```

### Get String Width

Calculates visible width of text, ignoring ANSI codes. Uses `Bun.stringWidth()` internally.

```typescript
import { getStringWidth } from "@outfitter/ui";

console.log(getStringWidth("Hello"));           // 5
console.log(getStringWidth("\x1b[31mHello\x1b[0m"));  // 5
```

## Content Renderers

### Markdown

Renders markdown to terminal with ANSI styling for headings, bold, italic, and code.

```typescript
import { renderMarkdown } from "@outfitter/ui";

const md = `# Heading

Some **bold** and *italic* text.

\`inline code\` and:

\`\`\`javascript
const x = 1;
\`\`\`
`;

console.log(renderMarkdown(md));
```

### JSON

Pretty-prints JSON data with indentation.

```typescript
import { renderJson } from "@outfitter/ui";

console.log(renderJson({ name: "test", value: 42 }));
// {
//   "name": "test",
//   "value": 42
// }
```

## Terminal Detection

### Get Terminal Width

Returns the terminal width, with a fallback of 80 for non-TTY environments.

```typescript
import { getTerminalWidth } from "@outfitter/ui";

const width = getTerminalWidth();  // e.g., 120 in a terminal, 80 if not TTY
```

### Is Interactive

Checks if the terminal is interactive (TTY and not CI).

```typescript
import { isInteractive } from "@outfitter/ui";

if (isInteractive()) {
  // Safe to use interactive prompts
} else {
  // Use non-interactive fallback
}
```

### Supports Color

Checks if the environment supports colors.

```typescript
import { supportsColor } from "@outfitter/ui";

// Uses automatic detection
if (supportsColor()) {
  // Colors are supported
}

// With explicit options
supportsColor({ isTTY: true });   // true
supportsColor({ isTTY: false });  // false (unless FORCE_COLOR is set)
```

## API Reference

### Types

```typescript
interface Theme {
  success: (text: string) => string;
  warning: (text: string) => string;
  error: (text: string) => string;
  info: (text: string) => string;
  primary: (text: string) => string;
  secondary: (text: string) => string;
  muted: (text: string) => string;
}

type ColorName = "green" | "yellow" | "red" | "blue" | "cyan" | "magenta" | "white" | "gray";

interface TableOptions {
  columnWidths?: Record<string, number>;
  headers?: Record<string, string>;
}

interface NestedListItem {
  text: string;
  children?: Array<string | NestedListItem>;
}

type ListItem = string | NestedListItem;

interface ProgressOptions {
  current: number;
  total: number;
  width?: number;      // Default: 20
  showPercent?: boolean;  // Default: false
}

interface TerminalOptions {
  isTTY?: boolean;
  isCI?: boolean;
}
```

## License

MIT
