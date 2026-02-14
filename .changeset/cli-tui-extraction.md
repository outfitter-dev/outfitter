---
"@outfitter/cli": minor
---

Extract TUI modules to `@outfitter/tui` package.

- **breaking**: Removed subpath exports: `./render`, `./table`, `./list`, `./box`, `./tree`, `./borders`, `./theme`, `./streaming`, `./prompt`, `./confirm`, `./preset`, `./demo`
- **breaking**: `confirmDestructive()` moved from `@outfitter/cli/input` to `@outfitter/tui/confirm`
- Colors (`./colors`), text utilities (`./text`), and terminal detection (`./terminal`) remain in `@outfitter/cli`
- Install `@outfitter/tui` and update imports for moved modules
