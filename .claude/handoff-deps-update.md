# Dependency Update Handoff

## Status: Ready to submit

Two stacked branches, fully verified (typecheck, lint, build, tests, all CI guardrails green).

## Stack

### Branch 1: `chore/update-deps-patch-minor` (on main)
4 commits:
1. Bun 1.3.7 → 1.3.9 (fixes CI crash — Bun panic/SIGILL on GitHub Actions)
2. bunup 0.16.22→0.16.29, lefthook 2.1.0→2.1.1, turbo 2.8.3→2.8.10, @types/node 25.2.1→25.3.0
3. biome 2.3.12→2.4.4, ultracite 7.1.1→7.2.3 (150 files auto-fixed for new `useSortedInterfaceMembers` rule — mechanical)
4. biome config migration + tooling snapshots updated

### Branch 2: `chore/update-deps-major` (stacked on branch 1)
2 commits:
1. @clack/prompts 0.10/0.11 → 1.0.1 (drop-in, no API changes affected us)
2. zod 3→4 in @outfitter/tooling (only change: `z.record(z.string())` → `z.record(z.string(), z.string())` in 3 places in schema.ts)

## What's left

- `gt submit --stack` to push both PRs
- PRs will need `no-changeset` label — the biome interface sorting touches 16 packages but is purely mechanical formatting
- Note: local Bun shell still reports 1.3.7 (needs shell restart to pick up 1.3.9 at ~/.bun/bin/bun); CI will use 1.3.9 via .bun-version

## CI context

The pre-existing CI failures on main were:
1. TypeScript error from OS-266 merge (fixed by OS-267 merge — stale cache)
2. Bun 1.3.7 crash (SIGILL panic) — fixed by the Bun upgrade in this stack

## No outdated deps remaining after this stack

`bun outdated` should be clean once both branches merge.
