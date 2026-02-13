# Outfitter Docs System Plan

## Status

- Owner: Stack team
- Primary issue anchor: `OS-107`
- Draft date: 2026-02-12
- Planning horizon: near-term implementation + medium-term extensibility

## Executive Summary

We will establish a reusable docs pipeline that serves three audiences:

1. Repo maintainers who need synchronized package docs in `docs/packages/*`
2. Agents/LLMs that need structured and plain-text docs feeds (`llms.txt`, `llms-full.txt`, agent export)
3. Product CLIs (`outfitter`, `waymark`, and other adopters) that need a consistent `docs` command surface

To keep boundaries clear and avoid a monolithic package, we will create **two packages**:

- `@outfitter/docs-core`: pure docs pipeline engine (no CLI concerns)
- `@outfitter/docs`: CLI + host-CLI adapter layer that consumes `docs-core`

This approach supports immediate `OS-107` needs while creating a stable foundation for MDX support and future site publishing (Starlight/Fumadocs) without premature lock-in.

## Goals

1. Centralize publishable package docs into `docs/packages/<name>/` with deterministic output.
2. Provide reusable docs tooling for Outfitter adopters (not only this monorepo).
3. Offer host-CLI integration so `outfitter docs` and `waymark docs` can share behavior.
4. Support Markdown today and MDX-ready ingestion for future compile targets.
5. Generate LLM-oriented artifacts from the same source graph to avoid drift.
6. Keep architecture modular, testable, and consistent with existing workspace patterns.

## Non-Goals (Initial Scope)

1. Building a complete docs website in this first implementation.
2. Supporting every MDX/JSX runtime feature from day one.
3. Creating an opinionated docs CMS.
4. Replacing existing root conceptual docs (`docs/ARCHITECTURE.md`, etc.).

## Constraints and Design Principles

1. Bun-first, TypeScript strict mode, tests-first.
2. Keep docs generation deterministic and CI-checkable.
3. Prefer small, composable modules; avoid all-in-one script growth.
4. Keep `@outfitter/tooling` focused on dev tooling workflows, not as the docs domain owner.
5. Allow adopters to configure source and output policies without forking the engine.

## Package Architecture

## 1) `@outfitter/docs-core`

Purpose: transport-agnostic docs pipeline.

### Responsibilities

- Source discovery (packages/docs globs)
- Package eligibility detection (publishable package rules)
- Parse and normalize Markdown/MDX sources into a docs graph
- Link rewriting for generated output locations
- Output renderers:
  - package mirror (`docs/packages/*`)
  - `llms.txt`
  - `llms-full.txt`
  - structured agent feed (JSON + optional markdown/plaintext)
- Check mode (detect drift vs committed artifacts)

### Non-responsibilities

- CLI option parsing
- Terminal rendering
- process exit handling

### Proposed module layout

```txt
packages/docs-core/
  src/
    index.ts
    config/
      schema.ts
      defaults.ts
    discovery/
      workspace.ts
      packages.ts
      files.ts
    parse/
      markdown.ts
      mdx.ts
      normalize.ts
    graph/
      types.ts
      build.ts
      links.ts
    render/
      packages.ts
      llms.ts
      llms-full.ts
      agent-feed.ts
    assemble/
      run.ts
      check.ts
      diff.ts
    io/
      fs.ts
      write.ts
    __tests__/
```

## 2) `@outfitter/docs`

Purpose: user/developer entry points that wrap `docs-core`.

### Responsibilities

- Standalone CLI command(s)
- Host-CLI adapter (`createDocsCommand`) for embedding in product CLIs
- Config loading and command orchestration
- Output formatting for humans and CI

### Proposed module layout

```txt
packages/docs/
  src/
    index.ts
    cli.ts
    command/
      create-docs-command.ts
    commands/
      sync.ts
      check.ts
      export.ts
    config/
      load.ts
      resolve.ts
    __tests__/
```

## Integration points

- `apps/outfitter`: mounts docs subcommand via adapter
- external adopters (e.g., Waymark): mount same adapter for `waymark docs`
- root prebuild: can call `@outfitter/docs` CLI for local sync workflows

## Command Surface (Target)

### Standalone (`@outfitter/docs`)

1. `docs sync`
- Materialize docs outputs (initially package mirror)

2. `docs check`
- Verify generated docs are up to date (CI-friendly non-zero on drift)

3. `docs export --target llms|llms-full|agent|packages`
- Explicit export actions for automation pipelines

### Embedded (host CLI)

- `outfitter docs sync|check|export ...`
- `waymark docs sync|check|export ...`

Adapter contract should allow host branding and defaults:

- product name
- default config path(s)
- default output root

## Config Strategy

Provide a shared config schema, likely file name:

- `outfitter.docs.config.ts` or `outfitter.docs.config.json`

### Initial config shape (illustrative)

```ts
interface DocsConfig {
  rootDir?: string;
  sources: {
    packages: {
      include: string[];         // e.g. ["packages/*"]
      readme: string;            // default "README.md"
      includeMd: boolean;        // true
      includeMdx: boolean;       // true (parse mode dependent)
      includeDocsDir: boolean;   // true
      exclude: string[];         // ["CHANGELOG.md"] etc.
      publishableOnly: boolean;  // true
    };
    docs?: {
      include: string[];
      exclude?: string[];
    };
  };
  outputs: {
    packagesMirror?: { outDir: string }; // docs/packages
    llms?: { file: string };
    llmsFull?: { file: string };
    agentFeed?: { outDir: string; format: "json" | "json+md" };
  };
  mdx: {
    mode: "strict" | "lossy";
    unsupportedHandling: "error" | "warn";
  };
  links: {
    rewriteRelative: boolean;
  };
}
```

## Markdown/MDX Strategy

We will treat MDX as first-class input but support output targets that do not understand MDX.

### Modes

1. `strict`
- Unsupported MDX constructs fail generation.
- Best for controlled pipelines/CI where fidelity is required.

2. `lossy`
- Best-effort transform to markdown/plain text.
- Emit warnings for dropped/altered constructs.
- Best for LLM and plain-text channels.

### Downleveling policy

- Preserve headings, paragraphs, lists, tables, code blocks, links.
- Convert known MDX directives/components when mapping exists.
- Strip unsupported JSX blocks with explicit warning annotations in logs.

## LLM Outputs Plan

Both `llms.txt` and `llms-full.txt` should be derived from the same docs graph.

### `llms.txt`

- concise curated index
- package summaries
- canonical path references
- high-signal sections for retrieval and routing

### `llms-full.txt`

- expanded merged content
- stable section delimiters for chunking
- optional metadata headers per section (id/path/package/type)

### Agent feed (future-compatible)

- structured JSON entries with:
  - id
  - title
  - source path
  - package
  - tags
  - normalized markdown/plaintext body

## OS-107 Implementation Mapping

`OS-107` is delivered in phases so value lands early while preserving architectural integrity.

## Phase 0: Foundation decisions (this plan)

Deliverables:

1. Agree on two-package split (`docs-core` + `docs`)
2. Lock first command scope to `sync` + `check` for package docs mirror
3. Confirm committed artifact policy for `docs/packages/*`

## Phase 1: Minimal vertical slice (OS-107 core)

Deliverables:

1. Add `@outfitter/docs-core` with package docs assembly API
2. Add `@outfitter/docs` with `sync` and `check` commands
3. Wire `outfitter docs` command in `apps/outfitter`
4. Update `scripts/prebuild.sh` to run docs sync
5. Update `docs/README.md` links to `./packages/<name>/`

Acceptance criteria:

1. `docs/packages/<name>/README.md` generated for publishable packages
2. non-publishable packages skipped (`private: true` or missing `package.json`)
3. additional `.md` files copied (excluding configured exclusions)
4. `docs/` subdir in packages mirrored
5. relative links rewritten correctly from new location
6. `check` exits non-zero when generated outputs are stale

## Phase 2: LLM outputs

Deliverables:

1. Add `llms.txt` renderer
2. Add `llms-full.txt` renderer
3. Add docs config entries for these targets
4. Add CI check for freshness

Acceptance criteria:

1. deterministic outputs from same source graph
2. change in source docs reflected in both files
3. check mode catches stale committed outputs

## Phase 3: MDX and compatibility

Deliverables:

1. MDX parser integration in `docs-core`
2. strict/lossy modes with warnings/errors
3. conversion tests for markdown and plain-text targets

Acceptance criteria:

1. strict mode fails unsupported constructs
2. lossy mode emits warnings and produces valid outputs

## Phase 4: Site publishing adapters (Starlight/Fumadocs)

Deliverables:

1. neutral site export manifest from docs graph
2. adapter docs for Starlight and Fumadocs ingestion
3. optional starter templates for docs site setup

Acceptance criteria:

1. no core model change needed when swapping target framework
2. site adapters consume existing normalized graph

## Testing Strategy (TDD-first)

## `docs-core` unit tests

1. package discovery and publishable filtering
2. docs file selection rules (README, extra md, docs/ subtree)
3. exclusion handling (`CHANGELOG.md`, configurable excludes)
4. link rewriting correctness for representative path patterns
5. deterministic output ordering
6. check-mode drift detection

## `docs` integration tests

1. command parsing and option behavior
2. exit codes for sync/check
3. host adapter mounting behavior
4. fixture-based end-to-end generation

## snapshot policy

- use snapshots where output volume is large
- pair snapshots with focused assertions for critical invariants

## CI and Workflow Integration

1. Add docs sync in prebuild for local consistency.
2. Add CI check equivalent to:
   - run docs generation
   - fail if git diff exists in generated docs artifacts
3. Ensure docs checks are fast and deterministic.
4. Avoid non-deterministic timestamps/content in generated files.

## Migration Plan for Current Repo

1. Introduce packages and commands without changing all docs at once.
2. Migrate existing assembly logic from ad-hoc script to `docs-core`.
3. Keep a thin compatibility script if needed during transition.
4. Update links in `docs/README.md` and cross references.
5. Document new workflow in repo docs.

## Adopter Story (Waymark and others)

Target adopter path:

1. install `@outfitter/docs`
2. add minimal docs config
3. mount `createDocsCommand` in host CLI
4. run `<product> docs sync` and `<product> docs check` in CI

This yields near-identical behavior across Outfitter-based projects while preserving product-specific command branding.

## Risks and Mitigations

1. Risk: scope creep into “full docs platform” too early.
- Mitigation: phase-gate features; ship OS-107 slice first.

2. Risk: MDX conversion complexity.
- Mitigation: strict/lossy modes and explicit unsupported-policy.

3. Risk: path rewrite regressions.
- Mitigation: fixture-driven tests and golden snapshots.

4. Risk: generated artifacts causing noisy diffs.
- Mitigation: deterministic sorting/formatting and check mode.

5. Risk: confusion between `tooling` and docs responsibilities.
- Mitigation: docs domain ownership in `@outfitter/docs*`; `tooling` only integrates as consumer.

## Open Questions to Resolve Before Phase 1 Completion

1. Generated docs policy: commit `docs/packages/*` by default? (recommended yes)
2. `CHANGELOG.md` handling: always exclude or configurable per project?
3. Include `packages/kit/shared/migrations/*.md` by default?
4. Default config file format: TS vs JSON
5. CLI binary naming for `@outfitter/docs`: `docs`, `outfitter-docs`, or both

## Deliverables Checklist

- [ ] `packages/docs-core` scaffolded with strict TS config + tests
- [ ] `packages/docs` scaffolded with CLI and adapter + tests
- [ ] `outfitter docs` command wired in `apps/outfitter`
- [ ] package docs mirror generation implemented
- [ ] check mode implemented
- [ ] `scripts/prebuild.sh` updated
- [ ] `docs/README.md` and cross-links updated
- [ ] CI freshness check added
- [ ] migration notes documented

## Suggested Issue Decomposition

1. `OS-107A` create `docs-core` assemble/check vertical slice
2. `OS-107B` integrate `@outfitter/docs` CLI + `outfitter docs`
3. `OS-107C` link/index migration and CI freshness gate
4. Follow-up: `OS-LLMS` add llms renderers
5. Follow-up: `OS-MDX` add MDX strict/lossy support
6. Follow-up: `OS-SITE` add Starlight/Fumadocs adapters

## Stacked Branch Strategy

Implementation is intentionally structured for Graphite stacked branches via
`gt split --by-commit`.

Working approach:

1. Land a linear sequence of clean, scoped commits in dependency order
2. Ensure each commit maps to exactly one Linear issue (`OS-148` through `OS-153`)
3. Keep commits self-contained and reversible (tests and docs included per slice)
4. Split the sequence into stacked branches after commit series is complete

Expected commit/issue order:

1. `OS-148` docs-core sync/check substrate
2. `OS-149` docs package CLI + adapter
3. `OS-150` outfitter wiring + prebuild integration
4. `OS-151` CI freshness + link migration
5. `OS-152` llms renderers
6. `OS-153` MDX strict/lossy processing

Branch naming convention for stack branches:

- end each branch name with `-os-###`
- example: `feat/docs-core/sync-check-os-148`

## Definition of Done (for OS-107)

1. Package docs are centralized under `docs/packages/*` through the new docs pipeline.
2. Generation is reproducible and enforced via `check` in CI.
3. Implementation resides in reusable docs packages, not one-off scripts.
4. `outfitter docs` command exists and is ready for adopter parity.
5. Architecture decisions for MDX and LLM outputs are documented and intentionally phased.
