# @outfitter/docs-core

## 0.1.2

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.1.1

### Patch Changes

- 573c6d3: Improve repo-maintenance bootstrap and boundary enforcement support.

  - Add source-first module loading for docs command execution in monorepo development (with dist fallback)
  - Remove `@outfitter/docs-core` runnable CLI surface and route prebuild docs sync through canonical `outfitter repo` command flow
  - Update boundary-invocation check fixtures and migration support for canonical repo command usage
