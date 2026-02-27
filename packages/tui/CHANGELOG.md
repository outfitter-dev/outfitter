# @outfitter/tui

## 0.2.2

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.2.1

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.2.0

### Minor Changes

- 839b4e1: Initial release of `@outfitter/tui` — terminal UI rendering extracted from `@outfitter/cli`.
  - **feat**: Tables, lists, boxes, trees, borders, headings, separators, progress bars
  - **feat**: Visual theme system with 4 presets (default, rounded, bold, minimal)
  - **feat**: Streaming output (spinners, in-place writers)
  - **feat**: Result-wrapped interactive prompts (text, select, confirm, group)
  - **feat**: `confirmDestructive()` for dangerous operation confirmation
  - **feat**: Preset bundles (standard, full) for common import patterns
  - **feat**: Demo infrastructure for rendering primitive previews
