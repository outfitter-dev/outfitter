# Scaffolding Research Addendum: Starters Repo + Builder UX

This note extends `.scratch/scaffolding-research.md` without changing it.

## Goal

Adopt a more flexible scaffolding model that works for internal monorepos and app repos, while avoiding an explosion of rigid pre-baked templates.

## Proposed Direction

### 1) Create `outfitter-dev/starters`

Stand up a dedicated repository for starter definitions and starter assets.

Scope for v1:
- Curated starters for our internal project types (not public marketplace yet)
- Versioned starter catalog (machine-readable)
- Shared docs for each starter (intent, constraints, maintenance owner)

Starter format (conceptual):
- Metadata: id, description, tags, maturity, owner
- Option matrix: framework/runtime/tooling/deploy choices
- Constraints: valid/invalid option combinations
- Recipes: what blocks/files/config transforms to apply
- Recreate command template: canonical command emission

Why separate repo:
- Keeps `outfitter` CLI lean and focused
- Lets starter definitions evolve independently of CLI release cadence
- Enables internal contribution workflow from teams adopting scaffolding

### 2) Add a TanStack-style "builder" flow to `outfitter create`

Instead of forcing users to pick from a long list of static scaffolds, provide a composable builder that assembles a command.

User experience:
- Interactive mode asks a small sequence of decisions (stack, package manager, testing, linting, deployment, etc.)
- Builder validates combinations in real time
- Output includes:
  - summary of selected options
  - exact canonical command to reproduce the scaffold
  - optional "run now" path

Non-interactive parity:
- Every interactive choice maps to flags
- Builder-generated command is copy/paste ready for CI and docs
- `--dry-run` always available to inspect planned operations

This gives us the ergonomics of guided setup plus deterministic automation.

### 3) Integrate CLI with starters repo via a catalog contract

`outfitter` CLI should read a starter catalog that can be pinned and validated.

Recommended contract:
- Catalog source: git ref/tag (default pinned in CLI release)
- Integrity: checksum for catalog payload
- Cache: local cache with explicit refresh command
- Fallback: bundled minimal catalog when offline

Operational knobs:
- `--catalog-ref` for testing upcoming starter versions internally
- `--starter` for direct starter selection
- `--json` output for automation and agent use

## Migration + Change Communication Policy (Aligned with internal-only adoption)

Because adoption is currently internal, we can use direct deprecation rather than extended compatibility windows.

Policy:
- Deprecate old behavior directly when replacement is ready
- Publish one internal agent migration guide per breaking behavior change
- Use changelog as the default source of migration truth
- Add dedicated docs only for high-impact/complex transitions

Changelog entry template for scaffold changes:
- What changed
- Who is affected
- Required action (`none` / `recommended` / `required`)
- Detection hint (how agents find impacted usage)
- Rewrite guidance (old -> new)
- Verification steps

This should replace ad hoc one-off migration notes as the default.

## Implementation Shape

### Phase 1: Foundation
- Define starter catalog schema and validation
- Add canonical command emission to current scaffolding flow
- Add `create --builder` interactive flow with flag parity

### Phase 2: Repository split
- Create `outfitter-dev/starters` and move starter definitions there
- Add catalog fetch/pin/cache support in CLI
- Add CI checks for starter schema, constraints, and smoke generation

### Phase 3: Deprecation + migration ops
- Directly deprecate legacy entry points/flags (internal-focused)
- Publish agent migration playbook and run an internal sweep
- Track completion in changelog and issue checklist

### Phase 4: Hardening
- Add more robust dry-run output and operation manifests
- Strengthen reproducibility guarantees across OS/package managers
- Add starter ownership + review rotations to prevent drift

## Benefits We Should Expect

### Developer experience
- Faster scaffold decisions with guided, validated choices
- Less confusion than maintaining many static scaffold variants
- Reproducible commands make docs, CI, and pair-debugging easier

### Platform reliability
- Single catalog contract reduces hidden template drift
- Constraints prevent invalid combinations before files are generated
- Pinned starter refs reduce "works on my machine" scaffolding variance

### Operational efficiency
- Independent starter repo reduces CLI release pressure
- Internal teams can iterate on starters without deep CLI changes
- Changelog-first communication lowers migration coordination overhead

### Agent effectiveness
- Canonical command output improves automation reliability
- Structured changelog + migration hints give agents a deterministic rewrite path
- Internal migration guides make deprecations cheaper to execute repeatedly

## Risks and Mitigations

Risk: Builder complexity grows quickly.
Mitigation: keep v1 to highest-frequency decisions; avoid speculative options.

Risk: Catalog/starter version mismatch with CLI behavior.
Mitigation: pin default catalog ref per CLI release; validate schema and compatibility at runtime.

Risk: Too-frequent breaking changes could create churn.
Mitigation: direct deprecation remains acceptable internally, but batch related changes into clear change windows with migration playbooks.

## Success Criteria

- New projects are scaffolded via builder flow in fewer steps than today
- Generated command is sufficient to reproduce output in CI
- Internal migrations for scaffold changes are completed via documented agent playbook
- Changelog entries become the primary migration source for routine changes
- Starter updates can ship independently without requiring immediate CLI releases
