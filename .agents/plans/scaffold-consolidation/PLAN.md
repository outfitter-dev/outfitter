# Scaffold Consolidation

**Status**: Proposed
**Last Updated**: 2026-02-12

## Why This Work Exists

The Outfitter CLI has two overlapping commands for creating new projects (`init` and `create`) with
duplicated logic and no clear boundary. Meanwhile, there is no command for adding a new capability
to an existing project — a real workflow gap.

This plan redefines the command model so each command has one clear job:

| Command | Job |
|---|---|
| `outfitter init` | Create a new project from scratch |
| `outfitter scaffold` | Add a capability to an existing project |
| `outfitter add` | Add tooling/config blocks (unchanged) |

## Design Rationale

The initial research (`.scratch/scaffolding-research.md`) recommended deprecating `init` in favor
of `create`. After further analysis, we reversed this direction:

- `init` is the conventional CLI verb for project creation (`npm init`, `git init`, `cargo init`).
  Users expect it to mean "start something new."
- `create` was Outfitter's experiment with interactive flows, but those flows belong in `init`.
- The real gap was not a better `create` — it was a way to add capabilities to existing projects.
  `scaffold` fills that gap with a distinct verb and clear scope.
- Keeping `init` for new projects and introducing `scaffold` for existing projects gives each
  command one unambiguous job, which is better than trying to overload either verb.

## Decisions

These were resolved in a Q&A session (2026-02-12):

1. **Verb**: `scaffold` (not `create` or `generate`) for adding capabilities to existing projects.
2. **`init` absorbs both modes**: Interactive prompts by default, `--yes`/`--preset` for scripted use. `create` is retired.
3. **Auto-convert to workspace**: When `scaffold` runs against a single-package project, it converts to workspace structure automatically with clear output.
4. **Single target registry**: One definition consumed by both `init` and `scaffold`. Each target defines how to apply standalone vs into a workspace.
5. **Target catalog defined upfront**: `minimal`, `cli`, `mcp`, `daemon`, `api`, `worker`, `web`, `lib`. Templates ship incrementally.
6. **`minimal` replaces `basic`**: The blank-canvas starting point. Init-only — not a scaffold target.
7. **Package placement**: Turborepo convention. `apps/` for runnable targets (cli, mcp, daemon, api, worker, web). `packages/` for libraries (lib).

## Target Catalog

| Target | Category | Placement | Status |
|---|---|---|---|
| `minimal` | Starting point | Root (init only) | Template exists as `basic` |
| `cli` | Runnable | `apps/<name>/` | Template exists |
| `mcp` | Runnable | `apps/<name>/` | Template exists |
| `daemon` | Runnable | `apps/<name>/` | Template exists |
| `api` | Runnable | `apps/<name>/` | Stub — needs template |
| `worker` | Runnable | `apps/<name>/` | Stub — needs template |
| `web` | Runnable | `apps/<name>/` | Stub — needs template |
| `lib` | Library | `packages/<name>/` | Stub — needs template |

Stub targets should be registered in the target registry with metadata but error clearly if
selected before their template is ready.

## User-Facing Target

```bash
# New projects (init absorbs create's interactive flow)
outfitter init my-tool                     # interactive — prompts for target
outfitter init my-tool --preset cli        # non-interactive
outfitter init my-tool --preset cli --yes  # skip all prompts

# Add capability to existing project
outfitter scaffold mcp                     # adds MCP server to workspace
outfitter scaffold api                     # adds API server to workspace
outfitter scaffold lib shared-utils        # adds library package

# Tooling blocks (unchanged)
outfitter add biome
outfitter add scaffolding
```

## Branch Stack

1. `feature/scaffold-target-registry`
2. `feature/scaffold-shared-engine`
3. `feature/scaffold-init-consolidation`
4. `feature/scaffold-command`
5. `feature/scaffold-workspace-conversion`
6. `feature/scaffold-post-scaffold`
7. `feature/scaffold-dry-run`
8. `feature/scaffold-retire-create`

## Slice Details

### Slice 0: Target Registry

Define the single source of truth for scaffold targets.

- Create a target registry module (`apps/outfitter/src/targets/registry.ts`)
- Each target entry includes: id, description, category (`runnable` | `library`), placement
  rule (`apps/` vs `packages/`), template directory, default blocks, status (`ready` | `stub`)
- Rename `basic` template to `minimal`
- Register all 8 targets (4 ready, 4 stubs)
- Stub targets return a clear error with "not yet available" messaging
- Tests:
  - Registry lookup by id
  - Category-based placement resolution
  - Stub target error behavior

### Slice 1: Shared Scaffolding Engine

Extract duplicated logic from `create.ts` and `init.ts` into a shared engine module.

- Extract into `apps/outfitter/src/engine/`:
  - Template walking and file copying (with `skipFilter` for mode-aware skipping)
  - Placeholder replacement
  - Binary file detection
  - Shared config injection (`SHARED_DEV_DEPS`, `SHARED_SCRIPTS`)
  - Local dependency rewriting (`workspace:*`)
  - Block integration (`runAdd`)
  - Workspace detection (`detectWorkspaceRoot`)
  - `EngineOptions` interface (`{ force }`, extended with `collector?` in Slice 6)
- Migrate planner to consume `TargetDefinition` from registry (replacing `CreatePresetDefinition`)
- Update `buildWorkspaceRootPackageJson` workspaces array to `["apps/*", "packages/*"]`
- Both `create` and `init` consume the shared engine (no behavior change yet)
- Tests:
  - Shared engine produces identical output to current commands
  - No regressions in existing `create.test.ts` and `init.test.ts`
  - `getTemplatesDir` anchors on marker file (not fragile path traversal)

### Slice 2: Init Consolidation

Merge `create`'s interactive flow and workspace support into `init`.

- `init` gains:
  - Interactive preset selection (from `create`)
  - `--preset` flag (replaces `--template`, maps to target registry)
  - `--structure single|workspace` (from `create`)
  - `--workspace-name` (from `create`)
  - `-y, --yes` flag for skipping all prompts
  - Author resolution from git config (already in `init`)
  - `-b, --bin` flag (already in `init`)
- Keep `init.cli`, `init.mcp`, `init.daemon` subcommands working (map to `--preset`)
- `create` still works but is unchanged — retirement comes later
- Deprecate `--template` flag in favor of `--preset` (warning + passthrough)
- Tests:
  - Interactive mode prompts for preset and structure
  - `--yes` skips all prompts
  - `--preset cli` matches `init cli` behavior
  - Workspace scaffolding works

### Slice 3: Scaffold Command

New command for adding capabilities to existing projects.

- `outfitter scaffold <target> [name]`
- Reads target from registry, validates it is not a stub
- Detects current project structure (single-package vs workspace)
- If already a workspace: scaffold target into correct location (`apps/` or `packages/`)
- Wire up workspace dependencies and references
- Scaffold target's template with placeholder replacement
- Add target's default blocks
- Tests:
  - Scaffold into existing workspace
  - Target placement by category (apps/ vs packages/)
  - Name defaults to target id if not provided
  - Error on non-existent or stub target
  - Non-Outfitter project triggers auto-adopt flow (manifest creation)

### Slice 4: Workspace Conversion

Auto-convert single-package projects to workspace when scaffolding.

- Detect single-package project (no `workspaces` in package.json)
- Convert:
  - Create workspace root package.json
  - Move existing package into `apps/<name>/` or `packages/<name>/` based on its type
  - Update internal references and paths
  - Scaffold the new target into the workspace
- Output clear summary of what changed ("Converted to workspace, moved existing package to
  apps/my-cli/, scaffolded apps/mcp/")
- Tests:
  - Single CLI project + scaffold MCP = workspace with both in apps/
  - Single lib project + scaffold cli = workspace with lib in packages/ and cli in apps/
  - Existing workspace is not re-converted
  - Manifest and dependency references updated correctly

### Slice 5: Post-Scaffold Automation

Run `bun install` and git setup after scaffolding.

- Apply to both `init` and `scaffold`:
  - Run `bun install` after file generation (opt-out: `--skip-install`)
  - For `init` only: run `git init && git add . && git commit -m "init: scaffold with outfitter"`
    when not already in a repo (opt-out: `--skip-git`)
- Surface install/git failures clearly but continue to next-steps output
- Display tailored next-steps instructions after scaffolding
- Tests:
  - Install runs by default
  - `--skip-install` suppresses install
  - Git init only when not in existing repo
  - `--skip-git` suppresses git setup
  - Failure in install does not block next-steps output

### Slice 6: Dry Run

Add `--dry-run` to `init` and `scaffold`.

- Collect all operations (file creates, dependency updates, block additions, post-scaffold
  actions) without executing them
- Render operation plan to stdout
- JSON mode: structured operation list
- Tests:
  - Dry run produces no filesystem changes
  - Operation plan matches actual execution output
  - JSON mode outputs parseable plan

### Slice 7: Retire Create

Remove the `create` command.

- Remove `create` from action registry
- Remove `apps/outfitter/src/commands/create.ts`
- Remove `create.test.ts`
- Update all docs, README, AGENTS.md references
- Ensure no internal tooling or plugins reference `create`
- Tests:
  - `outfitter create` returns helpful error pointing to `init`
  - All former `create` test scenarios pass via `init`

## Change Communication

Every breaking or behavior-changing slice should produce a changeset scoped to the affected
package(s). For this work, that is primarily `outfitter` (the CLI). Each changeset entry should
follow this template:

- **What changed**: Description of the behavior change
- **Who is affected**: Which users, projects, or workflows are impacted
- **Required action**: `none` | `recommended` | `required`
- **Detection hint**: How agents find impacted usage (grep patterns, file presence, etc.)
- **Rewrite guidance**: Old command/config -> new command/config
- **Verification steps**: How to confirm the migration worked

For high-impact changes (init consolidation, create retirement), also publish an internal agent
migration guide with full rewrite steps and rollback path.

For routine changes, the changelog entry is sufficient — no separate migration doc needed.

### Authoring workflow

Changesets are user-facing content, not commit log prose. Use an agent workflow to get them
tight:

1. **Draft**: Write the changeset using the template fields above
2. **Voice pass**: Run through the `outfitter-voice` skill to match Outfitter tone
3. **Docs pass**: Run through the `outfitter-documentation` skill for structure and completeness
4. **Commit**: Include the polished changeset in the slice's PR

For migration guides (init consolidation, create retirement), also run through
`outfitter-editorial` for a full review pass before publishing.

## Canonical Types

These types are defined once and referenced across multiple design documents. The canonical
location is the source of truth — other documents reference but do not redefine these types.

| Type | Canonical Doc | Module | Referenced By |
|---|---|---|---|
| `TargetDefinition` | TARGET-REGISTRY.md | `targets/types.ts` | SCAFFOLD-COMMAND, INIT-CONSOLIDATION |
| `TargetId` | TARGET-REGISTRY.md | `targets/types.ts` | SCAFFOLD-COMMAND, INIT-CONSOLIDATION |
| `PlaceholderValues` | SHARED-ENGINE.md | `engine/types.ts` | SCAFFOLD-COMMAND, POST-SCAFFOLD |
| `ScaffoldPlan` | SHARED-ENGINE.md | `engine/types.ts` | INIT-CONSOLIDATION, SCAFFOLD-COMMAND |
| `ScaffoldChange` | SHARED-ENGINE.md | `engine/types.ts` | INIT-CONSOLIDATION |
| `ScaffoldResult` | SHARED-ENGINE.md | `engine/types.ts` | POST-SCAFFOLD |
| `ScaffoldCommandResult` | SCAFFOLD-COMMAND.md | `commands/scaffold.ts` | — |
| `ScaffoldError` | SHARED-ENGINE.md | `engine/types.ts` | SCAFFOLD-COMMAND, POST-SCAFFOLD |
| `EngineOptions` | SHARED-ENGINE.md | `engine/types.ts` | POST-SCAFFOLD (adds `collector` in Slice 6) |
| `Operation` | POST-SCAFFOLD.md | `engine/collector.ts` | — |
| `OperationCollector` | POST-SCAFFOLD.md | `engine/collector.ts` | — |
| `PostScaffoldResult` | POST-SCAFFOLD.md | `engine/post-scaffold.ts` | — |
| `ProjectStructure` | SCAFFOLD-COMMAND.md | `commands/scaffold.ts` | — |

## Guardrails

- Default behavior is non-destructive. No overwrites without `--force`.
- Workspace conversion shows exactly what moved and why.
- Stub targets fail early with clear messaging.
- All handler logic returns `Result<T, E>`.
- Shared engine is tested independently before commands migrate to it.
- `create` is not removed until `init` passes all of create's existing tests.

## Completion Criteria

- `outfitter init` handles both interactive and non-interactive new project creation.
- `outfitter scaffold <target>` adds capabilities to existing projects.
- Single-package projects auto-convert to workspace on scaffold.
- Target registry defines all 8 targets with clear ready/stub status.
- Post-scaffold automation runs install and git setup by default.
- `--dry-run` shows operation plan without side effects.
- `create` command removed with no regressions.
- All behavior covered by tests.

## Resolved Questions

1. **Scaffold into non-Outfitter projects** — Auto-adopt. Prefer existing manifest, but if
   missing, create one as part of the scaffold operation. Safe default with broader reach.
2. **Target-specific post-scaffold hooks** — Hook scripts in template directories. Each target
   can include an optional post-scaffold `.ts` script. Engine runs it after file copying. Keeps
   engine generic, targets own their custom setup.
3. **Template inheritance for scaffold targets** — Shared templates with mode-aware application.
   One template per target. Engine skips root-level files (tsconfig, root package.json, workspace
   config) when scaffolding into a workspace. Avoids maintaining parallel template trees.
