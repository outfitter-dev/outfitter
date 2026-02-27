# @outfitter/docs

## 0.2.0

### Minor Changes

- 98f62bd: Consolidate `@outfitter/docs-core` into `@outfitter/docs` as `./core` subpath export. The `@outfitter/docs-core` package is now deprecated.

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.1.2

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).
- Updated dependencies [9fc51cc]
  - @outfitter/docs-core@0.1.2

## 0.1.1

### Patch Changes

- 573c6d3: Improve repo-maintenance bootstrap and boundary enforcement support.
  - Add source-first module loading for docs command execution in monorepo development (with dist fallback)
  - Remove `@outfitter/docs-core` runnable CLI surface and route prebuild docs sync through canonical `outfitter repo` command flow
  - Update boundary-invocation check fixtures and migration support for canonical repo command usage

- Updated dependencies [573c6d3]
  - @outfitter/docs-core@0.1.1
