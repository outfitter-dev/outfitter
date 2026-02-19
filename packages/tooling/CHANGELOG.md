# @outfitter/tooling

## 0.2.4

### Patch Changes

- Updated dependencies [4352c6d]
  - @outfitter/cli@0.5.1

## 0.2.3

### Patch Changes

- a1ae604: Add `check-changeset` CI gate that fails when PRs touch package source without a changeset.
- 573c6d3: Improve repo-maintenance bootstrap and boundary enforcement support.

  - Add source-first module loading for docs command execution in monorepo development (with dist fallback)
  - Remove `@outfitter/docs-core` runnable CLI surface and route prebuild docs sync through canonical `outfitter repo` command flow
  - Update boundary-invocation check fixtures and migration support for canonical repo command usage

## 0.2.2

### Patch Changes

- 4febd46: Retry publish for packages that failed due to npm OIDC configuration.

## 0.2.1

### Patch Changes

- 4894673: Complete migration system: add `--cwd` flag to `outfitter update`, ship migration docs in `@outfitter/kit` npm package, add migration docs for all packages.

## 0.2.0

### Minor Changes

- First npm publish — dev tooling presets and CLI

  - Biome preset with Outfitter-specific rules
  - TypeScript presets (strict base + Bun variant)
  - Lefthook git hooks preset (pre-commit + pre-push)
  - CLI commands: `init`, `check`, `fix`, `upgrade-bun`, `pre-push`

## 0.1.0

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

## 0.1.0-rc.2

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system
