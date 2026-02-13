# Outfitter Docs Decisions

## Status

- Related issue: `OS-107`
- Recorded on: 2026-02-12
- Decision state: Proposed defaults for implementation kickoff

## Decision Summary

1. We will implement docs infrastructure as **two packages**:
- `@outfitter/docs-core` (pipeline engine)
- `@outfitter/docs` (CLI + host adapter)

2. `docs/packages/*` will be **committed** to the repository and validated in CI.

3. We will support Markdown immediately and design for MDX with a phased strict/lossy model.

4. `outfitter docs` will be added via adapter-based integration, and the same adapter pattern will be used by adopters (e.g., `waymark docs`).

5. `llms.txt` and `llms-full.txt` will be generated from the same docs graph in a follow-up phase, not blocked on OS-107 core delivery.

## Detailed Decisions

## D1. Package split and ownership

Decision:

- Create `@outfitter/docs-core` and `@outfitter/docs`.
- Keep docs domain logic out of `@outfitter/tooling`.

Rationale:

- Enables reusable docs behavior across Outfitter-based projects.
- Prevents `tooling` from becoming a broad domain package.
- Matches existing workspace preference for focused package boundaries.

Consequences:

- Slightly more upfront scaffolding work.
- Cleaner long-term evolution for docs outputs and adapters.

## D2. Committed generated docs

Decision:

- `docs/packages/` is committed.
- CI runs docs sync and fails on drift.

Rationale:

- Browsable docs in GitHub without build step.
- Easier review visibility and contributor onboarding.
- Aligns with the need for agents to consume repo-visible documentation.

Consequences:

- Generated-file diffs will appear in PRs.
- Requires deterministic generation and stable ordering.

## D3. Initial scope for OS-107

Decision:

- First implementation includes:
  - package docs assemble (`sync`)
  - stale check (`check`)
  - link rewrite for relocated docs
- LLM outputs and MDX advanced handling are planned follow-ups.

Rationale:

- Keeps first delivery small and reversible.
- Delivers immediate value for the original issue goal.

Consequences:

- Additional phases needed before full docs platform capabilities land.

## D4. CLI integration pattern

Decision:

- `@outfitter/docs` exports a host adapter (`createDocsCommand`) plus standalone CLI commands.
- `apps/outfitter` mounts `docs` using the adapter.
- Adopters mount same adapter to get `<product> docs` parity.

Rationale:

- Preserves product-specific CLI branding while sharing behavior.
- Avoids copy-paste command implementations across projects.

Consequences:

- Need careful API design for adapter options (name, defaults, config path).

## D5. Markdown/MDX handling policy

Decision:

- Markdown is baseline input/output.
- MDX support is introduced in phases with two modes:
  - `strict` (error on unsupported constructs)
  - `lossy` (best-effort transform + warnings)

Rationale:

- Enables future docs authoring flexibility.
- Maintains compatibility for non-MDX targets (LLM feeds, plain text consumers).

Consequences:

- Requires parser/transform abstraction in `docs-core` early.
- Some MDX features may initially be unsupported.

## D6. LLM output strategy

Decision:

- Generate `llms.txt` and `llms-full.txt` from the same normalized docs graph.
- Land as follow-up phase after core sync/check is stable.

Rationale:

- Prevents divergence between human docs and model-facing docs.
- Reuses same pipeline for consistency and maintainability.

Consequences:

- Requires explicit curation and formatting conventions.
- Adds CI surface area once introduced.

## D7. Site publishing strategy (Starlight/Fumadocs)

Decision:

- Do not bind core to a specific docs site framework yet.
- Produce neutral normalized content/manifest first.
- Add framework adapters later.

Rationale:

- Preserves optionality between Starlight and Fumadocs.
- Avoids premature framework lock-in.

Consequences:

- Some setup work deferred until framework choice is finalized.

## Divergence From OS-107 (Intentional)

This section captures where implementation planning intentionally extends or changes the issue framing.

## A. From script-in-repo to package architecture

Issue framing:

- Proposed a repo-local script (`scripts/assemble-docs.ts`) as the primary implementation.

Decision:

- Implement in `@outfitter/docs-core` + `@outfitter/docs` packages and have scripts/CLI call into that.

Why divergence is intentional:

- Requirement expanded to include reuse by Outfitter adopters and embedded CLI parity (`waymark docs`).
- Package architecture avoids re-implementing logic in each project.

## B. From tooling-owned feature to docs-owned feature

Issue framing:

- Suggested changeset/prebuild/CI workflows without explicit package ownership.

Decision:

- `@outfitter/tooling` may orchestrate, but docs logic is owned by dedicated docs packages.

Why divergence is intentional:

- Clearer long-term ownership and modularity.
- Keeps tooling focused on general dev workflows.

## C. Explicit phased expansion to MDX + LLM outputs

Issue framing:

- Focused primarily on centralizing package docs.

Decision:

- Preserve OS-107 core scope for phase 1, but explicitly design and plan for MDX downleveling and LLM outputs in subsequent phases.

Why divergence is intentional:

- Avoids architectural dead ends that would require rework once MDX and LLM targets are added.

## D. Embedded CLI parity as first-class requirement

Issue framing:

- Focused on monorepo docs reorganization.

Decision:

- Add adapter-based command embedding so external adopters can expose `<product> docs` with same behavior.

Why divergence is intentional:

- Directly supports the stated product direction for Outfitter-based projects.

## Defaults to Implement (Kickoff)

1. Commit generated `docs/packages/*`.
2. Exclude `CHANGELOG.md` by default.
3. Include package-level `docs/` subdirectories when present.
4. Skip `private: true` or missing `package.json` packages.
5. Use deterministic output ordering and no timestamps.
6. Add `sync` + `check` first, then expand targets.

## Open Decisions Still Needed

1. Should `packages/kit/shared/migrations/*.md` be included by default in package mirror output?
2. Preferred config filename and format (`outfitter.docs.config.ts` vs JSON).
3. CLI binary naming preference for `@outfitter/docs` in addition to host embedding.
4. CI job placement (existing verify pipeline vs dedicated docs freshness job).

## Change Log

- 2026-02-12: Initial decision set recorded from planning discussion and package/workspace review.

