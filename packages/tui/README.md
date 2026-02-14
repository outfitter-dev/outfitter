# @outfitter/tui

Terminal UI rendering: tables, lists, boxes, trees, spinners, themes, prompts, and streaming for Bun.

**Stability: Active** -- APIs evolving based on usage.

## Installation

```bash
bun add @outfitter/tui
```

### Peer Dependencies

```bash
bun add @outfitter/cli @outfitter/contracts @outfitter/types
```

`@outfitter/tui` depends on `@outfitter/cli` for colors, text utilities, and terminal detection. It does not bundle these -- they must be installed separately.

## Quick Start

```typescript
import { renderTable } from "@outfitter/tui/table";
import { renderList } from "@outfitter/tui/list";
import { renderBox } from "@outfitter/tui/box";

// Render a table
console.log(renderTable([
  { name: "config", status: "loaded", entries: 12 },
  { name: "cache", status: "warm", entries: 847 },
]));

// Render a bullet list
console.log(renderList(["First item", "Second item", "Third item"]));

// Render a bordered box
console.log(renderBox("Operation complete", { title: "Status" }));
```

## Subpath Exports

Every module is available as a subpath import. No deep imports into `dist/` needed.

### Rendering Primitives

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/render` | All rendering utilities (tables, lists, boxes, trees, formatting, layout, shapes) |
| `@outfitter/tui/table` | `renderTable`, `TableOptions` |
| `@outfitter/tui/list` | `renderList`, `ListOptions`, `ListStyle` |
| `@outfitter/tui/box` | `renderBox`, `createBox`, `BoxOptions` |
| `@outfitter/tui/tree` | `renderTree`, `TreeOptions`, `TREE_GUIDES` |
| `@outfitter/tui/borders` | `BORDERS`, `getBorderCharacters`, `drawHorizontalLine` |

### Themes

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/theme` | `createVisualTheme`, `defaultTheme`, `roundedTheme`, `boldTheme`, `minimalTheme` |
| `@outfitter/tui/theme/presets` | All preset themes |
| `@outfitter/tui/theme/presets/default` | Default theme only |
| `@outfitter/tui/theme/presets/rounded` | Rounded theme only |
| `@outfitter/tui/theme/presets/bold` | Bold theme only |
| `@outfitter/tui/theme/presets/minimal` | Minimal theme only |
| `@outfitter/tui/theme/context` | `createThemedContext`, `getContextTheme` |
| `@outfitter/tui/theme/create` | `createVisualTheme` factory |
| `@outfitter/tui/theme/resolve` | `resolveGlyph`, `resolveStateMarker` |

### Streaming Output

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/streaming` | `createSpinner`, `createStreamWriter`, `ANSI` |
| `@outfitter/tui/streaming/spinner` | `createSpinner`, `Spinner`, `SpinnerOptions` |
| `@outfitter/tui/streaming/writer` | `createStreamWriter`, `StreamWriter` |
| `@outfitter/tui/streaming/ansi` | ANSI escape sequence constants |

### Interactive Prompts

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/prompt` | `promptText`, `promptSelect`, `promptConfirm`, `promptGroup`, `validators` |
| `@outfitter/tui/prompt/text` | `promptText`, `promptPassword` |
| `@outfitter/tui/prompt/select` | `promptSelect`, `promptMultiSelect` |
| `@outfitter/tui/prompt/confirm` | `promptConfirm` |
| `@outfitter/tui/prompt/group` | `promptGroup` |
| `@outfitter/tui/prompt/validators` | Validation helpers |
| `@outfitter/tui/confirm` | `confirmDestructive` (destructive operation confirmation) |

### Presets

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/preset/standard` | Table + list + box + colors (most common bundle) |
| `@outfitter/tui/preset/full` | Standard + tree + borders |

### Demo Infrastructure

| Subpath | What's In It |
|---------|-------------|
| `@outfitter/tui/demo` | `renderDemo`, `renderAllDemos`, primitive metadata |
| `@outfitter/tui/demo/section` | Section helpers for building demos |

## Themes

The visual theme system provides a unified design language for borders, delimiters, markers, colors, and spacing.

```typescript
import {
  defaultTheme,
  roundedTheme,
  createVisualTheme,
  createThemedContext,
} from "@outfitter/tui/theme";

// Use a preset theme
import { renderBox } from "@outfitter/tui/box";
const box = renderBox("Hello", { theme: roundedTheme });

// Create a custom theme extending a preset
const brandTheme = createVisualTheme({
  extends: roundedTheme,
  overrides: {
    colors: { success: "\x1b[38;5;82m" },
    spacing: { boxPadding: 2 },
  },
});

// Create a themed context for cascading theme options
const ctx = createThemedContext({ theme: brandTheme, width: 80 });
```

**Available presets:** `defaultTheme`, `roundedTheme`, `boldTheme`, `minimalTheme`

## Streaming

In-place terminal updates for spinners and progress indicators.

```typescript
import { createSpinner, createStreamWriter } from "@outfitter/tui/streaming";

// Spinner for async operations
const spinner = createSpinner("Indexing files...");
spinner.start();
await indexFiles();
spinner.succeed("Indexed 847 files");

// Stream writer for custom in-place updates
const writer = createStreamWriter();
writer.write("Progress: 0%");
writer.update("Progress: 50%");
writer.update("Progress: 100%");
writer.persist();
```

## Prompts

Result-wrapped interactive prompts using Clack, with validators and group utilities.

```typescript
import {
  promptText,
  promptSelect,
  promptConfirm,
  promptGroup,
  validators,
} from "@outfitter/tui/prompt";

// Single prompt
const name = await promptText({
  message: "Project name:",
  validate: validators.required(),
});

if (name.isOk()) {
  console.log(`Creating ${name.value}...`);
}

// Grouped prompts for wizard-style flows
const config = await promptGroup({
  name: () => promptText({ message: "Name:" }),
  template: () => promptSelect({
    message: "Template:",
    options: [
      { value: "basic", label: "Basic" },
      { value: "full", label: "Full Stack" },
    ],
  }),
  debug: () => promptConfirm({ message: "Enable debug mode?" }),
});
```

### Destructive Confirmation

For operations that delete or overwrite data, use `confirmDestructive` from `@outfitter/tui/confirm`:

```typescript
import { confirmDestructive } from "@outfitter/tui/confirm";

const result = await confirmDestructive({
  message: "Delete 5 notes?",
  bypassFlag: flags.yes,
  itemCount: 5,
});

if (result.isErr()) {
  console.error("Operation cancelled");
  process.exit(0);
}
```

This respects `--yes` flags for non-interactive mode and returns an error in non-TTY environments.

## Presets

Presets bundle common imports to reduce boilerplate.

```typescript
// Standard: covers most use cases
import {
  renderTable,
  renderList,
  renderBox,
  createTheme,
} from "@outfitter/tui/preset/standard";

// Full: standard + tree + borders
import {
  renderTable,
  renderTree,
  BORDERS,
  getBorderCharacters,
} from "@outfitter/tui/preset/full";
```

## Relationship to @outfitter/cli

`@outfitter/tui` extracts visual rendering concerns from `@outfitter/cli`. The split:

| Package | Responsibility |
|---------|---------------|
| `@outfitter/cli` | Output modes, input parsing, pagination, terminal detection, colors, text utilities, command building |
| `@outfitter/tui` | Tables, lists, boxes, trees, borders, themes, spinners, streaming, prompts |

`@outfitter/cli` provides the foundation (colors, text, terminal). `@outfitter/tui` builds visual components on top.

## License

MIT
