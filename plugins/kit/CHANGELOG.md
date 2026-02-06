# outfitter-kit

## 1.5.0

### Minor Changes

- Consolidate `stack-audit` and `stack-review` into `outfitter-check`
- Simplify `outfitter-feedback` with search-before-create workflow

#### Skill Simplification: outfitter-feedback

The `outfitter-feedback` skill has been streamlined and improved with a search-first workflow.

**Key Changes:**

- **Simplified**: Reduced from 176 lines to 75 lines
- **Search before create**: New `search-issues.sh` script to check for duplicates
- **Clearer structure**: Focus on the two main actions (search → create)
- **Streamlined issue types**: Consolidated table with required fields

**New Script:**

```bash
# Search existing issues before creating duplicates
./scripts/search-issues.sh "Result unwrap error"
```

#### Skill Consolidation: stack-review → outfitter-check

The `stack-review` skill has been renamed and improved to `outfitter-check`. The `stack-audit` skill has been removed entirely (its functionality was already covered by `outfitter-init`).

**Key Changes:**

- **Renamed**: `stack-review` → `outfitter-check` for consistent `outfitter-*` naming
- **Deleted**: `stack-audit` (redundant with `outfitter-init`)
- **Improved structure**: Now follows the pattern of `debug-outfitter` with:
  - Clear Goal section
  - Constraints (DO/DON'T)
  - Numbered steps
  - TEMPLATE.md for report output
- **Severity levels**: Critical > High > Medium > Low with clear definitions
- **Pass criteria**: PASS (0 critical, 0 high), WARNINGS, FAIL

**New Structure:**

```
outfitter-check/
├── SKILL.md      # 4-step compliance check methodology
└── TEMPLATE.md   # Compliance report template
```

**Migration:**

References to deprecated skills have been updated:
- `kit:stack-review` → `kit:outfitter-check`
- `kit:stack-audit` → `kit:outfitter-init`

## 1.4.0

### Minor Changes

- Restructure `stack-audit` into `outfitter-init` with unified initialization workflow

#### Skill Restructure: stack-audit → outfitter-init

The `stack-audit` skill has been transformed into `outfitter-init`, a unified skill for both greenfield projects and migrations to Outfitter Stack patterns.

**Key Changes:**

- **4-stage methodology**: Follows `debug-outfitter`'s proven structure (Assess → Configure → Execute → Verify)
- **New output path**: `.outfitter/adopt/` → `.agents/plans/outfitter-init/`
- **Simplified file naming**: Removed numbered prefixes from stage files
  - `00-overview.md` → `overview.md`
  - `01-foundation.md` → `foundation.md`
  - etc.
- **New entry point**: Added `PLAN.md` as navigation hub
- **Project type detection**: Automatically detects greenfield vs migration

**New Structure:**

```
outfitter-init/
├── SKILL.md                     # 4-stage methodology
├── migration/
│   ├── assessment.md            # Scope evaluation + decision tree
│   └── patterns-quick-ref.md    # Quick lookup → links to fieldguide
├── templates/
│   ├── PLAN.md                  # Plan entry point
│   ├── SCAN.md                  # Scan results
│   └── stages/                  # Stage task files (no numbered prefixes)
├── scripts/
│   └── scan.ts                  # Codebase scanner
└── references/
    └── manual-scan.md           # Ripgrep commands
```

**Design principle**: outfitter-init handles *workflow* (scan, plan, track progress). outfitter-fieldguide has the *patterns* (how to convert code). No duplication.

**New agent**: `outfitter` — Dedicated agent for running the init workflow. Loads both `outfitter-fieldguide` and `outfitter-init` skills automatically.

**Migration:**

References to deprecated skill have been updated:
- `kit:stack-audit` → `kit:outfitter-init`

## 1.3.0

### Minor Changes

- Consolidate skills into unified `outfitter-fieldguide`

#### Skill Consolidation

Three skills have been consolidated into `kit:outfitter-fieldguide`:

- `stack-patterns` → merged into fieldguide patterns/
- `stack-templates` → merged into fieldguide templates/
- `stack-architecture` → merged into fieldguide guides/architecture.md

The new fieldguide provides a single, comprehensive reference for all @outfitter/* patterns, templates, and architecture guidance.

#### New Documentation

- **guides/architecture.md**: Full 5-step design process with handler inventory, error strategy, and implementation order templates
- **@outfitter/tooling**: Added documentation for dev tooling presets (Biome, TypeScript, Lefthook)
- **@outfitter/index**: Added documentation for SQLite FTS5 full-text search
- **@outfitter/kit**: Added documentation for version coordination meta-package

#### Package Tier Updates

- Updated package tier diagram to include all 13 packages
- Added `@outfitter/tooling` to Tooling tier
- Added `@outfitter/index` to Runtime tier
- Added `@outfitter/kit` as meta-package for version coordination

#### Debugger Refactoring

- Renamed `stack-debug` skill to `debug-outfitter`
- Created new `outfitter-debugger` agent for systematic debugging
- Restructured debugging as a 4-stage investigation process
- Added Debug Report template for consistent output
- Added troubleshooting quick reference to fieldguide
- Integrated with `outfitter-feedback` for escalating Outfitter bugs

#### Feedback Skill Rename

- Renamed `stack-feedback` skill to `outfitter-feedback`

#### Migration

All references to deprecated skills have been updated:
- `kit:stack-patterns` → `kit:outfitter-fieldguide`
- `kit:stack-templates` → `kit:outfitter-fieldguide`
- `kit:stack-architecture` → `kit:outfitter-fieldguide`
- `kit:stack-debug` → `kit:debug-outfitter`
- `kit:stack-feedback` → `kit:outfitter-feedback`

## 1.2.0

### Minor Changes

- Update documentation to match upstream @outfitter/\* package changes

#### New Documentation

- **CLI utilities**: Document `parseDateRange`, `formatDuration`, `formatBytes`, `pluralize`, `slugify`, `registerRenderer`
- **File operations reference**: New `references/file-ops.md` with atomic writes, `withSharedLock()` reader-writer locking, secure paths
- **@outfitter/types**: Document collection helpers (`sortBy`, `dedupe`, `chunk`) and type utilities (`Prettify<T>`, `DeepPartial`, `Nullable`)
- **Package tier system**: Document Foundation/Runtime/Tooling tier architecture in stack-architecture skill
- **ERROR_CODES constant**: Document validation constant for error categories

#### Pattern Updates

- **MCP tools**: Update templates to use `defineTool()` helper for better type inference
- **UI merger**: Note that `@outfitter/ui` merged into `@outfitter/cli`

#### Fixes

- Fix incorrect `@outfitter/result` package references to `@outfitter/contracts`

## 1.1.0

### Minor Changes

- d23cdf3: Add outfitter-stack plugin with comprehensive Stack pattern tooling

  - 7 skills: stack-patterns, stack-templates, stack-audit, stack-review, stack-architecture, stack-feedback, stack-debug
  - 1 agent: stacker (skill-aware routing for Stack work)
  - 2 commands: /adopt (phased adoption workflow), /audit (quick compliance check)
  - Rich reference material for all @outfitter/\* packages
