# Mixed Adoption IA

Status: Finalized (OS-90)  
Parent Workstream: OS-77  
Last Updated: 2026-02-09

This document defines the finalized information architecture for mixed adoption
of Outfitter packages after pilot validation.

## Final Recommendation

Default recommendation: start kit-first and progress in small, explicit steps.

1. Start in **State 1 (Baseline Foundation)** for all new and existing repos.
2. Move to **State 2 (Baseline + Transport)** when one surface (CLI or MCP) is
   actively being modernized.
3. Move to **State 3 (Granular Runtime Adoption)** only when there is clear
   package-level ownership and test coverage for incremental runtime rollout.

Why this is the default:

- It keeps the first change small (`@outfitter/kit` foundation imports) while
  preserving forward paths to full runtime adoption.
- It works for both greenfield scaffolding and existing repos.
- It aligns with pilot outcomes and keeps migration blast radius low.

## Validated Tooling Behavior (Post-Pilot)

The following behavior is validated for non-interactive adoption workflows:

- `outfitter create --no-tooling` skips default tooling blocks.
- `outfitter init --no-tooling` skips default tooling blocks.
- `outfitter init --with <blocks>` and `outfitter create --with <blocks>`
  provide explicit tooling selection.
- `outfitter init` remains non-destructive for existing repos unless `--force`
  is provided.

These points resolve the pilot friction captured in OS-94 and OS-95.

## Three-State Adoption Model

### State 1: Baseline Foundation

Use the foundation facade and keep transport/runtime dependencies explicit.

- Foundation imports:
  - `@outfitter/kit`
  - `@outfitter/kit/foundation/contracts`
  - `@outfitter/kit/foundation/types`
- Runtime dependencies are added only when used (`@outfitter/cli`,
  `@outfitter/mcp`, `@outfitter/logging`, etc.).
- Best for teams that want minimal change and a stable contract-first baseline.

### State 2: Baseline + Transport

Start from State 1, then adopt one transport/runtime surface end-to-end.

- Typical first transport: CLI (`@outfitter/cli`) or MCP (`@outfitter/mcp`).
- Logging integration is recommended once transport is active.
- Best for teams shipping one entrypoint first.

### State 3: Granular Runtime Adoption

Adopt additional runtime packages by concern over time.

- Add targeted packages (`@outfitter/config`, `@outfitter/file-ops`,
  `@outfitter/state`, `@outfitter/daemon`, `@outfitter/index`,
  `@outfitter/testing`).
- Keep each package adoption scoped and testable.
- Best for mature repos migrating incrementally with package-level ownership.

## Decision Matrix

| Signal | Choose | Why |
|---|---|---|
| Need contract/error model immediately, transport later | State 1 | Smallest change surface and low migration risk |
| One active CLI or MCP surface needs modernization now | State 2 | Fast path to tangible workflow improvements |
| Repo has package owners and concern-level test coverage | State 3 | Enables gradual migration without big-bang rewrites |
| Urgent logging consistency gaps | State 2 + logging track | Logging slices are independently stackable |
| Existing repo needs scaffolding safety | State 1 + `init/create --no-tooling` | Reduces accidental tooling churn during adoption |

## Migration Path Narrative

### Path A: Foundation-First

1. Adopt foundation imports via `@outfitter/kit`.
2. Run codemod where needed:
   - `outfitter migrate kit --dry-run`
   - `outfitter migrate kit`
3. Enable one transport slice (CLI or MCP).
4. Expand into granular runtime packages only where justified.

### Path B: Existing Transport-First Repos

1. Keep current transport package usage.
2. Migrate foundation imports to kit facade.
3. Move logging to unified logger factory stack.
4. Incrementally adopt missing runtime packages by concern.

### Path C: Monorepo Mixed State

1. Apply foundation codemod at workspace root (`outfitter migrate kit`).
2. Prioritize package-level transport migrations by business impact.
3. Standardize tooling behavior with explicit flags:
   - use `--no-tooling` for no-op tooling adoption,
   - use `--with` for targeted tooling additions.

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

### Kit + Create/Adoption Track

| Issue | Scope | Adoption Impact |
|---|---|---|
| OS-85 | repurpose `@outfitter/kit` as foundation facade | defines new foundation import surface |
| OS-86 | templates switched to kit-first defaults | greenfield defaults align with facade model |
| OS-88 | create planner/presets | deterministic scaffolding protocol |
| OS-89 | interactive `outfitter create` flow | practical entrypoint for mixed adoption |
| OS-87 | `outfitter migrate kit` codemod | one-command existing-repo foundation migration |
| OS-92 | IA draft and cross-workstream narrative | established pre-pilot model and framing |
| OS-91 | pilots and friction capture | validated repo archetypes and surfaced gaps |
| OS-90 | post-pilot finalize | recommendation and tooling behavior finalized |

## Evidence Base

- Pilot report: [PILOT-KIT-FIRST-ADOPTION.md](./PILOT-KIT-FIRST-ADOPTION.md)
- Pilot-originated follow-ups:
  - OS-94: `create --no-tooling` behavior mismatch
  - OS-95: `init`/`create` tooling flag parity
- OS-90 implementation resolves the behavior gaps and incorporates them into
  final recommendation guidance above.

## Related Docs

- [Migration Guide](./MIGRATION.md)
- [Architecture](./ARCHITECTURE.md)
- [Patterns](./PATTERNS.md)
