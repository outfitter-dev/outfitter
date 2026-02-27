# @outfitter/presets

## 0.2.1

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.2.0

### Minor Changes

- 70c1bac: Migrate to Bun workspace catalogs and @outfitter/presets for centralized dependency version management. Scaffold engine and registry now resolve versions dynamically from presets. Remove deprecated --template CLI flag. Rename internal template references to preset.
