# @outfitter/docs-core

## 0.1.1

### Patch Changes

- 573c6d3: Improve repo-maintenance bootstrap and boundary enforcement support.

  - Add source-first module loading for docs command execution in monorepo development (with dist fallback)
  - Remove `@outfitter/docs-core` runnable CLI surface and route prebuild docs sync through canonical `outfitter repo` command flow
  - Update boundary-invocation check fixtures and migration support for canonical repo command usage
