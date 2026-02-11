---
name: outfitter-start
version: 1.0.1
description: "Start with Outfitter Stack — scaffold new projects or adopt patterns in existing codebases. Detects context, scans for adoption candidates, and orchestrates phased conversion."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion
---

# Outfitter Start

Start with Outfitter Stack — new projects or existing codebase adoption.

## Steps

1. **Detect scenario** — Check for `package.json`:
   - No package.json → **New project** (continue to [New Project Scaffolding](#new-project-scaffolding))
   - Has package.json → **Existing project** (continue to step 2)
2. **Load skills** — Load `outfitter-atlas` (patterns) and `context-management` (task persistence).
3. **Scan** — Run the setup script to generate `.agents/plans/outfitter-start/` with scan results and staged plan.
4. **Review** — Present SCAN.md findings to user. Use AskUserQuestion for scope and priority decisions.
5. **Execute stages** — Work through stages in dependency order:
   - **Foundation** — Scaffold Result types, logger, dependencies (outfitter-atlas)
   - **Handlers** — TDD handler conversions (tdd-fieldguide + outfitter-atlas)
   - **Errors** — Map custom errors to taxonomy
   - **Adapters** — Wire CLI/MCP transport layers
   - **Documents** — Update docs to reflect new patterns
6. **Verify** — Load `outfitter-check` for compliance audit.
7. **Feedback** — If issues discovered, load `outfitter-issue` to report.
8. **Persist** — Update Tasks throughout with progress and decisions.

---

## New Project Scaffolding

For new projects, use the CLI with agent-guided setup.

### Step 1: Gather Context

Check for files that inform template choice:

```bash
ls CLAUDE.md SPEC.md PLAN.md README.md 2>/dev/null
```

**If context files exist**, read them and look for keywords:
- "CLI", "command-line", "tool" → suggest `cli` template
- "MCP", "server", "tools for AI" → suggest `mcp` template
- "daemon", "background", "service" → suggest `daemon` template
- Otherwise → suggest `basic` template

### Step 2: Ask User Questions

Use AskUserQuestion to clarify before running commands. See [references/new-project-scaffolding.md](references/new-project-scaffolding.md) for the full decision flow.

**Key questions:**
1. Template type (CLI, MCP, daemon, basic)
2. Project name
3. Whether to include tooling (scaffolding block)

### Step 3: Run the CLI

```bash
outfitter init <cli|mcp|daemon> . --name <name>
# Or: outfitter init . --template <template> --name <name>
```

**Options:**
- `--no-tooling` — Skip biome, lefthook, claude settings
- `--with <blocks>` — Specific blocks: `claude`, `biome`, `lefthook`, `bootstrap`, `scaffolding`
- `--force` — Overwrite existing files

### Step 4: Report and Suggest Next Steps

After scaffolding:
1. List key files created
2. Suggest: `bun install && bun run dev`
3. Recommend loading `outfitter-atlas` for pattern reference

---

## Migration Workflow

For existing projects, generate a phased adoption plan.

### Goal

Produce a structured adoption plan at `.agents/plans/outfitter-start/` containing:
1. Scan results showing what needs conversion (SCAN.md)
2. Stage-by-stage task files tracking progress (stages/)
3. Clear completion criteria for each stage

### Constraints

**DO:**
- Load fieldguide first — it has the patterns, this skill has the workflow
- Run the setup script to generate the plan
- Work through stages in dependency order
- Mark progress in `stages/overview.md`

**DON'T:**
- Skip the scan phase
- Duplicate fieldguide content (reference it instead)
- Work on blocked stages before dependencies complete

### Steps

1. Load `outfitter-atlas` — you need it for conversion patterns
2. [Assess the codebase](#stage-1-assess) — run the setup script, review SCAN.md
3. [Configure the plan](#stage-2-configure) — adjust priorities in `stages/overview.md`
4. [Execute stage by stage](#stage-3-execute) — Foundation → Handlers → Errors → Adapters → Documents
5. [Verify compliance](#stage-4-verify) — run `outfitter-check`, confirm no violations
6. Delete the plan directory when adoption is complete

## Stage 1: Assess

Run the setup script to scan the codebase and generate the plan.

### What to Run

```bash
# From the plugin directory (when installed):
./skills/outfitter-start/scripts/setup.sh [project-root]

# Or use the skill's scan functionality directly
```

The script will refuse to run if a plan already exists (won't override).

### What Gets Generated

```
.agents/plans/outfitter-start/
├── PLAN.md       # Entry point with navigation
├── SCAN.md       # Scan results, effort estimates
└── stages/       # Task files for each stage
```

### What to Review in SCAN.md

| Finding | Meaning |
|---------|---------|
| 0 throws, 0 custom errors | Greenfield — skip to Foundation, use fieldguide templates |
| 1-5 throws | Low effort — straightforward conversions |
| 6-15 throws | Medium effort — plan your approach |
| 16+ throws | High effort — work through stages methodically |
| Custom error classes | Map each to taxonomy (see `stages/errors.md`) |
| High console count | Lots of logging to convert (see `stages/handlers.md`) |
| Package Discovery table | Review all `@outfitter/*` options before installing |
| High blast radius handlers | Split into caller-focused sub-phases before converting |

`@outfitter/types` should be treated as **optional** unless the target project
has clear branded-type or utility adoption points.

### Decision Point

After reviewing SCAN.md:
- **Greenfield?** → Load fieldguide, use its templates directly
- **Migration?** → Continue to Stage 2

## Stage 2: Configure

Adjust the plan based on your assessment.

### What to Do

1. Open `stages/overview.md`
2. Review the status dashboard
3. Adjust stage order if needed (Paths can run parallel with Handlers)
4. Add notes about decisions or blockers

### Stage Dependencies

```
Foundation (required first)
    │
    ├── Paths (can run parallel)
    │
    └── Handlers
            │
            ├── Errors
            │
            └── Adapters
                    │
                    └── Documents (last)

Unknowns: Review throughout, resolve before Documents
```

## Stage 3: Execute

Work through stages in order, updating `stages/overview.md` as you go.

### For Each Stage

1. Open the stage file (e.g., `stages/foundation.md`)
2. Work through the checklist items
3. Reference fieldguide for conversion patterns:
   - **Throws → Result**: [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md)
   - **Error taxonomy**: [patterns/errors.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/errors.md)
   - **Logging**: [patterns/logging.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/logging.md)
   - **Templates**: [templates/](${CLAUDE_PLUGIN_ROOT}/shared/templates/)
4. Mark complete in `stages/overview.md`
5. Move to next unblocked stage

### Progress Markers

Update `stages/overview.md` as you work:

| Status | When to Use |
|--------|-------------|
| ⬜ Not Started | Haven't begun this stage |
| 🟡 In Progress | Currently working on it |
| ✅ Complete | All checklist items done |
| 🔴 Blocked | Waiting on another stage |
| ⏭️ Skipped | Not applicable (e.g., no MCP tools) |

### Quick Reference

For fast pattern lookup during execution: [migration/patterns-quick-ref.md](migration/patterns-quick-ref.md)

## Stage 4: Verify

Confirm the codebase follows Outfitter Stack patterns.

### Verification Commands

Run these — all should return no results:

```bash
# No throws in application code
rg "throw new" --type ts -g "!*.test.ts"

# No console logging (except entry points)
rg "console\.(log|error|warn)" --type ts -g "!*.test.ts"

# No hardcoded home paths
rg "homedir\(\)" --type ts
```

### Full Compliance Audit

Run the review skill for comprehensive checking:

```
/outfitter-check
```

### Completion Criteria

From `stages/overview.md`:

- [ ] All handlers return `Result<T, E>`
- [ ] No `throw` statements in application code
- [ ] No `console.log` in production code
- [ ] All paths use XDG conventions
- [ ] CLI uses `output()` and `exitWithError()`
- [ ] Documentation reflects new patterns
- [ ] All unknowns resolved or documented
- [ ] Tests updated and passing

### When Complete

Delete the plan directory:

```bash
rm -rf .agents/plans/outfitter-start
```

## Files

| File | Purpose |
|------|---------|
| [references/new-project-scaffolding.md](references/new-project-scaffolding.md) | Full guide for new project setup |
| [scripts/setup.sh](scripts/setup.sh) | Entry point — generates migration plan |
| [migration/assessment.md](migration/assessment.md) | Decision tree for scope evaluation |
| [migration/patterns-quick-ref.md](migration/patterns-quick-ref.md) | Quick lookup → links to fieldguide |
| [references/manual-scan.md](references/manual-scan.md) | Manual ripgrep commands |

## Related Skills

- `outfitter-atlas` — Patterns and templates (load first)
- `outfitter-check` — Compliance verification
