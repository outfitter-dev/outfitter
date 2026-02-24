---
paths:
  - "packages/tooling/**"
---

# Tooling Testing Playbook

1. Are tests current?

- Run `bun run test --filter=@outfitter/tooling`.
- Green means tooling tests and snapshots are current.

2. Config preset changed?

- Applies to `packages/tooling/lefthook.yml`, `packages/tooling/tsconfig.preset*.json`.
- Run `cd packages/tooling && bun test --update-snapshots`.
- Review `.snap` diffs. If diff is wrong, fix source config, not snapshot.

3. Registry block changed?

- If `packages/tooling/src/registry/build.ts` changed, keep tests derived from `REGISTRY_CONFIG`.
- Avoid hardcoded block names, file counts, or extends arrays in assertions.

4. CLI behavior changed?

- Update behavioral assertions in `packages/tooling/src/__tests__/cli.test.ts`.
- Treat CLI tests as contract tests.

5. Before push

- Run `bun run verify:ci` from repo root.
- Do not submit with stale snapshots or failing tooling tests.
