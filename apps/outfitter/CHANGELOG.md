# Changelog

## 0.3.4

### Patch Changes

- Updated dependencies [ea916e5]
  - @outfitter/oxlint-plugin@0.1.1

## 0.3.3

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

- Updated dependencies [98f62bd]
- Updated dependencies [debf2e2]
  - @outfitter/docs@0.2.0
  - @outfitter/cli@0.5.3
  - @outfitter/config@0.3.4
  - @outfitter/contracts@0.4.2
  - @outfitter/daemon@0.2.5
  - @outfitter/logging@0.4.2
  - @outfitter/mcp@0.4.3
  - @outfitter/presets@0.2.1
  - @outfitter/tooling@0.3.4
  - @outfitter/tui@0.2.2
  - @outfitter/types@0.2.4

## 0.3.2

### Patch Changes

- Updated dependencies [ec34a0c]
  - @outfitter/tooling@0.3.3

## 0.3.1

### Patch Changes

- Updated dependencies [f38bb82]
  - @outfitter/tooling@0.3.2

## 0.3.0

### Minor Changes

- 70c1bac: Migrate to Bun workspace catalogs and @outfitter/presets for centralized dependency version management. Scaffold engine and registry now resolve versions dynamically from presets. Remove deprecated --template CLI flag. Rename internal template references to preset.

### Patch Changes

- Updated dependencies [70c1bac]
  - @outfitter/presets@0.2.0
  - @outfitter/tooling@0.3.1

## 0.2.7

### Patch Changes

- c37b4b0: CLI polish: add `--cwd` to `doctor` and `add` commands, normalize `check` output mode to use `--output` preset (keep `--ci` as deprecated alias), fix "check check" display in schema, normalize `/tmp` paths via `realpath`, filter upgrade scan by positional args, and surface workspace version conflicts in `upgrade` output.
- b3e6b5d: Remove deprecated `@outfitter/kit` package. Templates now depend on `@outfitter/contracts` and `@outfitter/types` directly.
- 9fc51cc: Upgrade @clack/prompts to 1.0.1 and zod to 4.3.5 in @outfitter/tooling. Cascade version updates to templates, registry, and documentation.
- Updated dependencies [0055e2d]
- Updated dependencies [c37b4b0]
- Updated dependencies [43388f2]
- Updated dependencies [2e8843f]
- Updated dependencies [b3e6b5d]
- Updated dependencies [9fc51cc]
- Updated dependencies [9fc51cc]
  - @outfitter/tooling@0.3.0
  - @outfitter/cli@0.5.2
  - @outfitter/config@0.3.3
  - @outfitter/contracts@0.4.1
  - @outfitter/docs@0.1.2
  - @outfitter/logging@0.4.1
  - @outfitter/tui@0.2.1

## 0.2.6

### Patch Changes

- Updated dependencies [4352c6d]
  - @outfitter/cli@0.5.1
  - @outfitter/tooling@0.2.4
  - @outfitter/tui@0.2.0

## 0.2.5

### Patch Changes

- Updated dependencies [26f51bb]
- Updated dependencies [13b36de]
- Updated dependencies [1c70a3e]
  - @outfitter/cli@0.5.0
  - @outfitter/contracts@0.4.0
  - @outfitter/tui@0.2.0
  - @outfitter/config@0.3.2
  - @outfitter/logging@0.4.0

## 0.2.4

### Patch Changes

- Updated dependencies [2395095]
  - @outfitter/cli@0.4.1
  - @outfitter/tui@0.2.0

## 0.2.3

### Patch Changes

- Updated dependencies [a1ae604]
- Updated dependencies [d683522]
- Updated dependencies [839b4e1]
- Updated dependencies [d683522]
- Updated dependencies [d683522]
- Updated dependencies [d683522]
- Updated dependencies [573c6d3]
- Updated dependencies [839b4e1]
  - @outfitter/tooling@0.2.3
  - @outfitter/cli@0.4.0
  - @outfitter/config@0.3.1
  - @outfitter/contracts@0.3.0
  - @outfitter/logging@0.4.0
  - @outfitter/docs@0.1.1
  - @outfitter/tui@0.2.0

## 0.2.2

### Patch Changes

- Updated dependencies [4febd46]
  - @outfitter/tooling@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [4894673]
- Updated dependencies [0c099bc]
- Updated dependencies [8d48564]
- Updated dependencies [2da60d3]
  - @outfitter/cli@0.3.0
  - @outfitter/tooling@0.2.1
  - @outfitter/config@0.3.0
  - @outfitter/logging@0.3.0

## 0.2.0

### Minor Changes

- CLI improvements for scaffolding and diagnostics
  - Add `--json` output mode for `init`, `add`, and `doctor` commands
  - Route output through typed output contract
  - Fix command registration for scaffolded projects

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @outfitter/cli@0.2.0
  - @outfitter/config@0.2.0
  - @outfitter/contracts@0.2.0
  - @outfitter/logging@0.2.0
  - @outfitter/tooling@0.2.0

## 0.1.0

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:
  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- Updated dependencies [2a45c44]
- Updated dependencies [4f58c46]
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
  - @outfitter/cli@0.1.0
  - @outfitter/contracts@0.1.0
  - @outfitter/config@0.1.0
  - @outfitter/tooling@0.1.0

## 0.1.0-rc.3

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:
  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.3
  - @outfitter/cli@0.1.0-rc.4
  - @outfitter/config@0.1.0-rc.4
  - @outfitter/tooling@0.1.0-rc.2

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies [2a45c44]
- Updated dependencies [7522622]
  - @outfitter/cli@0.1.0-rc.3
  - @outfitter/config@0.1.0-rc.3

## [0.1.0] - 2026-01-23

### Added

- Initial release
- `init` command for scaffolding cli/mcp/daemon projects
- `doctor` command for environment diagnostics
