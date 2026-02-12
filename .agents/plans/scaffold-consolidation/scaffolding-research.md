# Scaffolding Research: shadcn/ui + create-better-t-stack

Research into scaffolding patterns from two successful projects, compared against Outfitter's current approach.

## How Each Tool Works

### shadcn/ui - "Registry as Protocol"

- Components are source files stored in a monorepo, compiled to JSON at build time, and served as static files
- CLI fetches JSON, resolves dependency trees recursively, transforms code via ts-morph AST manipulation, then writes to the user's project
- Users own the code with no package dependency lock-in
- `diff` shows what changed upstream versus local
- MCP server lets AI tools browse and install components programmatically
- Open registry protocol lets anyone host a compatible endpoint

**Key architecture:**

| Layer | Implementation |
|-------|---------------|
| CLI framework | Commander.js |
| Registry schema | Zod with multiple item types |
| Code transformation | ts-morph AST pipeline |
| Project detection | File and dependency heuristics |
| Dependency resolution | Recursive tree traversal with dedup |
| Build | pnpm + Turborepo, registry compiled to static JSON |
| Update mechanism | `diff` command (user-controlled updates) |

### create-better-t-stack - "Virtual Filesystem + Embedded Templates"

- Templates are compiled into a TypeScript `Map<string, string>` at build time
- Generation runs fully in memory via `memfs`
- Shared core API powers CLI, tests, and web preview
- Compatibility validation prevents invalid stack combinations
- Generated projects include config with hosted JSON schema for IDE help
- Uses `better-result`, same Result library family we use

**Key architecture:**

| Layer | Implementation |
|-------|---------------|
| CLI framework | oRPC + trpc-cli |
| Template engine | Handlebars |
| Template storage | Build-time embedded map |
| VFS | `memfs` |
| Schema validation | Zod v4 |
| Testing | Programmatic API smoke tests |

---

## Outfitter Reality Check

Before adopting anything, we should anchor on what already exists.

| Capability | Current state |
|---|---|
| Deterministic planning (`planCreateProject()`) | Already strong |
| Block/registry + manifest stamping | Already strong |
| Drift detection (`outfitter check`) | Already strong |
| Programmatic scaffolding API | Already present (`runCreate`, `runInit`) |
| `create` and `init` command surfaces | Both currently first-class |
| Post-scaffold automation (`bun install`, git setup) | Missing |
| Dry-run for scaffolding (`create` and `init`) | Missing today (`add` and `migrate` already have it) |
| Shared scaffolding engine between `create` and `init` | Missing (duplication exists) |

---

## High-Value Patterns to Adopt

### 1. Post-scaffolding automation with guardrails

Keep this split into two independent knobs:

| Track | Default behavior | Opt-out | Guardrails |
|---|---|---|---|
| Dependency install | Run `bun install` | `--skip-install` | Surface failures clearly and continue to next-steps output |
| Git bootstrap | Run git setup for fresh directories | `--skip-git`, `--skip-commit` | Only run when not already in a repo |

This gives immediate time savings while avoiding brittle "one big shell chain" behavior.

### 2. Add scaffolding dry-run for `create` and `init`

Dry-run should report exactly what would happen:

- File operations: create, overwrite, skip
- Dependency updates
- Block additions and manifest writes
- Post-scaffold actions that would run (`bun install`, git actions)

This can be implemented first without VFS by collecting and rendering operations before execution.

### 3. Deprecate `init` directly in favor of `create`

Given only internal adoption so far, we do not need a long compatibility runway.

Proposed stance:

- Mark `init` as deprecated now
- Keep a short warning window
- Remove `init` after our internal migration sweep is complete

Rationale: one obvious command reduces confusion and support burden.

### 4. Build an internal agent migration guide for all breaking changes

For every behavior change in scaffolding, publish one internal guide that agents can apply across adopted repos.

Guide template:

- What changed
- Detection pattern (how to find affected usage)
- Rewrite steps (before and after commands, config updates)
- Verification checklist
- Rollback path

This should be standard not only for `init` deprecation, but for any future scaffold-affecting changes.

### 4.1 Change communication policy: changelog-first, playbook for major changes

We should shift from "separate migration notes for many changes" to a simpler policy:

- Default path for most changes: Keep one high-quality changelog stream with structured entries.
- Major changes only: Maintain dedicated docs or add focused sections to existing docs when impact is broad or non-obvious, then link them directly from changelog entries.

Changelog entry template for scaffold-affecting changes:

- **What changed**: Description of the behavior change
- **Who is affected**: Which users, projects, or workflows are impacted
- **Required action**: `none` | `recommended` | `required`
- **Detection hint**: How agents find impacted usage (grep patterns, file presence, etc.)
- **Rewrite guidance**: Old command/config -> new command/config
- **Verification steps**: How to confirm the migration worked

This gives us a single source of truth for day-to-day change communication, while still supporting deeper guidance when needed.

### 5. Extract shared scaffolding engine (pre-VFS)

`create` and `init` currently duplicate core logic (template walking, placeholder replacement, binary handling). Before introducing VFS, extract a shared engine module to:

- Reduce drift and bug surface area
- Make dry-run implementation cleaner
- Lower migration risk for deprecating `init`

### 6. Introduce VFS generation layer

Once shared engine exists, move planning and write execution to an in-memory filesystem:

- Better testability
- True atomic write behavior
- Easier web preview path
- More deterministic dry-run output

### 7. Add `$schema` support for Outfitter metadata

Add `$schema` support for `.outfitter/manifest.json` or companion config to improve editor assistance and validation.

### 8. Reproducible command emission

Emit a canonical "recreate this scaffold" command in output and metadata for easier sharing and CI reproducibility.

### 9. Open registry protocol, but with security model

If external registries become a goal, ship protocol + trust controls together:

- Source allowlist or explicit trust prompt
- Checksums/signatures for fetched payloads
- Dependency policy guardrails

---

## Patterns That Do Not Apply Yet

| Pattern | Why not now |
|---|---|
| Handlebars templating everywhere | Current placeholder model is sufficient for present template complexity |
| Full compatibility matrix engine | Presets are limited and mostly independent today |
| Build-time template embedding | Lower ROI at current template count |
| MCP browsing for scaffolding registry | Useful later, not urgent at current scale |
| Public telemetry/analytics | Not required at this stage |

---

## Execution Plan

### Now (high impact, low to medium effort)

| Item | Effort | Risk | Acceptance criteria |
|---|---|---|---|
| Post-scaffold automation | S | M | `create` and `init` run install by default, opt-out flags exist, failures surface clearly |
| Scaffolding dry-run | M | M | `create --dry-run` and `init --dry-run` show deterministic operation plan and perform no writes |
| Direct `init` deprecation | S | L | `init` prints deprecation warning, internal migration guide published, usage inventory created |
| Internal agent migration guide | S | L | One reusable guide template adopted for all scaffold behavior changes |
| Changelog-first migration policy | S | L | Changelog template includes impact/action fields and is used for scaffold changes |

### Next (medium effort, structural improvements)

| Item | Effort | Risk | Acceptance criteria |
|---|---|---|---|
| Shared scaffolding engine extraction | M | M | `create` and `init` use shared module for file/template operations |
| `$schema` support | S | L | Manifest/config has schema reference and validation/docs are updated |
| Reproducible command output | S | L | Scaffold output and JSON mode include canonical recreate command |

### Later (strategic)

| Item | Effort | Risk | Acceptance criteria |
|---|---|---|---|
| VFS layer | L | M | Generation and tests can run in memory with explicit write phase |
| Open registry protocol + trust model | L | H | External source support ships with integrity and trust controls |
| AST transforms for advanced customization | L | M | Only added when templates require structural rewrites |

---

## Benefits on the Other Side

If we execute this plan end-to-end, we should expect:

- Faster project bootstrap: New projects become runnable immediately after scaffold with less manual setup.
- Lower cognitive load: One primary command (`create`) and one migration path reduce internal confusion.
- Safer changes: Dry-run plus operation plans reduce accidental file mutations.
- Better reliability: Shared engine reduces duplicated logic and drift between command paths.
- Easier internal migrations: An agent guide turns breaking changes from ad hoc effort into repeatable operational work.
- Cleaner change communication: A strong changelog removes the need for scattered one-off migration notes.
- Stronger testability: Shared engine and later VFS improve confidence and reduce filesystem-coupled tests.
- Better DX in generated projects: Schema-backed metadata and reproducible commands improve editor support and consistency.
- Clear path to ecosystem expansion: If we open the registry later, we do it with trust boundaries built in.

---

## Sources

- [DeepWiki: shadcn-ui/ui](https://deepwiki.com/shadcn-ui/ui) - CLI system, registry architecture, code transformations, dependency resolution, build pipeline
- [DeepWiki: create-better-t-stack](https://deepwiki.com/AmanVarshney01/create-better-t-stack) - CLI architecture, template system, VFS, generation pipeline, testing
- Direct source examination of both repos
- Outfitter source review in `apps/outfitter/src/commands/create.ts`, `apps/outfitter/src/commands/init.ts`, `apps/outfitter/src/create/planner.ts`, `apps/outfitter/src/actions.ts`, and `apps/outfitter/src/index.ts`.
