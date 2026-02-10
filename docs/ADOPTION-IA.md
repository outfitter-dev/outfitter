# Mixed Adoption IA (Draft)

Status: Draft (OS-92)  
Parent Workstream: OS-77  
Last Updated: 2026-02-09

This document defines the initial information architecture for mixed adoption of
Outfitter packages while the implementation stack is still moving.

The goal is to make early adoption decisions explicit and reversible:

- pick a starting posture based on risk and velocity,
- make migration paths between postures explicit,
- tie adoption guidance to specific implementation slices.

Pilot-derived recommendations are intentionally marked as pending.

## Three-State Adoption Model

### State 1: Baseline Foundation

Use the foundation facade and keep transport/runtime dependencies explicit.

- Foundation imports:
  - `@outfitter/kit`
  - `@outfitter/kit/foundation/contracts`
  - `@outfitter/kit/foundation/types`
- Runtime dependencies are added only when used (`@outfitter/cli`,
  `@outfitter/mcp`, `@outfitter/logging`, etc.).
- Best for teams that want a minimal contract-first baseline now.

### State 2: Baseline + Transport

Start from State 1, then adopt one transport/runtime surface end-to-end.

- Typical first transport:
  - CLI (`@outfitter/cli`) or MCP (`@outfitter/mcp`).
- Logging integration recommended once transport is active.
- Best for product teams shipping one entrypoint first.

### State 3: Granular Runtime Adoption

Adopt additional runtime packages by concern over time.

- Add targeted packages (`@outfitter/config`, `@outfitter/file-ops`,
  `@outfitter/state`, `@outfitter/daemon`, `@outfitter/index`, `@outfitter/testing`).
- Keep each package adoption scoped and testable.
- Best for mature repos migrating incrementally with package-level ownership.

## Decision Matrix (Draft)

| Signal | Choose | Why |
|---|---|---|
| Team needs the contract/error model immediately, transport later | State 1 | Smallest change surface and low migration risk |
| Team has one active CLI or MCP surface to modernize now | State 2 | Fastest path to tangible workflow improvements |
| Repo already has stable tooling boundaries and package owners | State 3 | Enables gradual migration without big-bang rewrites |
| Repo has urgent logging consistency gaps | State 2 + logging track | Logging slices are already independently stackable |

## Migration Path Narrative

### Path A: Foundation-first

1. Adopt foundation imports via `@outfitter/kit`.
2. Run codemod where needed:
   - `outfitter migrate kit --dry-run`
   - `outfitter migrate kit`
3. Enable one transport slice (CLI or MCP).
4. Expand into granular runtime packages only where justified.

### Path B: Existing transport-first repos

1. Keep current transport package usage.
2. Migrate foundation imports to kit facade.
3. Move logging to unified logger factory stack.
4. Incrementally adopt missing runtime packages by concern.

### Path C: Monorepo mixed state

1. Apply foundation codemod at workspace root (`outfitter migrate kit`).
2. Prioritize package-level transport migrations by business impact.
3. Track outliers in pilot follow-ups before standardizing defaults.

## Cross-Workstream Map

### Logging Workstream (OS-78 .. OS-84)

| Issue | Scope | Adoption Impact |
|---|---|---|
| OS-78 | logging migration framing | establishes migration boundary and sequencing |
| OS-79 | backend-agnostic logger factory contract | stable contract for adapters and BYO backends |
| OS-80 | logtape-backed internals | preserves API while consolidating backend behavior |
| OS-81 | Outfitter defaults + redaction semantics | standardizes safe defaults across surfaces |
| OS-82 | CLI logger wiring | transport-level consistency for CLI output/log context |
| OS-83 | MCP logger wiring | request/tool-level consistency for MCP surfaces |
| OS-84 | BYO logger docs + integration matrix | external backend adoption path and verification |

Primary doc link: [LOGGING-MIGRATION.md](./LOGGING-MIGRATION.md)

### Kit + Create/Adoption Track (A-track)

| Issue | Scope | Adoption Impact |
|---|---|---|
| OS-85 | repurpose `@outfitter/kit` as foundation facade | defines new foundation import surface |
| OS-86 | templates switched to kit-first defaults | greenfield defaults align with facade model |
| OS-88 | create planner/presets | deterministic scaffolding protocol |
| OS-89 | interactive `outfitter create` flow | practical entrypoint for mixed adoption |
| OS-87 | `outfitter migrate kit` codemod | one-command existing-repo foundation migration |
| OS-92 | this IA and narrative draft | aligns docs before pilot feedback lands |
| OS-91 | pilots and friction capture | validates defaults in real repos |
| OS-90 | post-pilot init/recommendation finalize | converts draft guidance into final defaults |

## Pilot-Dependent Placeholders

These sections are intentionally unresolved until OS-91/OS-90:

- `TODO(OS-91)`: default starting state by repo archetype
  - (single-package app, polyrepo service, monorepo package group).
- `TODO(OS-91)`: common migration friction patterns and mitigations.
- `TODO(OS-90)`: final `outfitter init` recommendation language.
- `TODO(OS-90)`: final "when to choose granular adoption" thresholds.

## Related Docs

- [Migration Guide](./MIGRATION.md)
- [Architecture](./ARCHITECTURE.md)
- [Patterns](./PATTERNS.md)
