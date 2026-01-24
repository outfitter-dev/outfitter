# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added

- **Color Tokens**
  - `createTheme()` - Create semantic color theme with success, warning, error, info, primary, secondary, and muted colors
  - `applyColor()` - Apply named color to text (green, yellow, red, blue, cyan, magenta, white, gray)
  - `supportsColor()` - Detect color support respecting NO_COLOR, FORCE_COLOR, and TTY

- **Terminal Detection**
  - `getTerminalWidth()` - Get terminal width with fallback to 80 for non-TTY
  - `isInteractive()` - Check if terminal is interactive (TTY and not CI)

- **Text Formatting**
  - `stripAnsi()` - Remove ANSI escape codes from text
  - `getStringWidth()` - Calculate visible width ignoring ANSI codes (via Bun.stringWidth)
  - `wrapText()` - Word wrap with ANSI code preservation across line breaks
  - `truncateText()` - Truncate with ellipsis and ANSI code awareness
  - `padText()` - Pad text to width with ANSI code awareness

- **Output Shapes**
  - `renderTable()` - ASCII table rendering with automatic column width calculation, custom headers, and column width options
  - `renderList()` - Nested bullet list rendering with indentation
  - `renderTree()` - Unicode tree rendering with box-drawing characters
  - `renderProgress()` - Progress bar rendering with optional percentage display

- **Content Renderers**
  - `renderMarkdown()` - Basic markdown to terminal with heading, bold, italic, and code styling
  - `renderJson()` - JSON pretty printing with indentation
  - `renderText()` - Plain text passthrough

- **Types**
  - `Theme` - Theme interface with semantic and text color functions
  - `ColorName` - Union type of available color names
  - `TableOptions` - Table rendering configuration
  - `ListItem` - List item type supporting strings and nested items
  - `NestedListItem` - Nested list item with text and children
  - `ProgressOptions` - Progress bar configuration
  - `TerminalOptions` - Terminal detection options
