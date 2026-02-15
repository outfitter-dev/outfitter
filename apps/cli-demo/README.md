# outfitter-cli-demo

Dedicated CLI demo app for rendering and terminal primitives from `@outfitter/cli` and `@outfitter/tui`.

## Usage

```bash
bun run apps/cli-demo/src/cli.ts --help
bun run apps/cli-demo/src/cli.ts --list
bun run apps/cli-demo/src/cli.ts colors
```

Installed binary names:

- `outfitter-demo`
- `cli-demo`
- `outfitter-showcase` (compatibility alias)
- `cli-showcase` (compatibility alias)

## Command

```text
outfitter-demo [section] [options]
```

Options:

- `-l, --list` - List available sections
- `-a, --animate` - Run animated spinner demo
- `--json` - Emit JSON output (global flag from `createCLI`)
- `--jsonl` - Emit JSONL output

## Purpose

This app exists so demo functionality is decoupled from the `outfitter` scaffolding CLI.
