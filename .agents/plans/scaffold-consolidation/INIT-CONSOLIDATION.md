# Init Consolidation: Detailed Migration Map

**Slice**: `feature/scaffold/2-init-consolidation`
**Depends on**: Slice 1 (shared scaffolding engine)
**Last Updated**: 2026-02-12

---

## 1. What init Needs to Absorb from create

### 1.1 Capabilities create Has That init Lacks

| Capability | create location | Status in init |
|---|---|---|
| Interactive preset selection (`@clack/prompts select`) | `resolveInput()` L674-688 | Missing -- init is fully non-interactive |
| `--preset` flag (named presets: basic/cli/mcp/daemon) | `CreateOptions.preset` | Missing -- init uses `--template` |
| `--structure single\|workspace` flag | `CreateOptions.structure` | Missing |
| `--workspace-name` flag | `CreateOptions.workspaceName` | Missing |
| `-y, --yes` skip-all-prompts flag | `CreateOptions.yes` | Missing |
| Workspace root scaffolding (`scaffoldWorkspaceRoot`) | `create.ts` L560-626 | Missing |
| Package placement under `packages/<name>/` | `runCreate()` L791-793 | Missing |
| Create planner/plan execution model | `create/planner.ts`, `executePlan()` | Missing -- init does direct template copy |
| Interactive package name prompt | `resolveInput()` L659-668 | Missing |
| Interactive structure prompt | `resolveInput()` L691-712 | Missing |
| Interactive tooling prompt | `resolveInput()` L715-726 | Missing |
| Interactive local dependency prompt | `resolveInput()` L728-739 | Missing |
| Interactive workspace name prompt | `resolveInput()` L742-758 | Missing |

### 1.2 Capabilities init Has That create Lacks

| Capability | init location | Notes |
|---|---|---|
| `-b, --bin` flag | `InitOptions.bin` | create derives bin from project name only |
| `author` placeholder resolution (git config) | `resolveAuthor()` L274-300 | create has no author field |
| `--json` output flag | `initCommand()` L796 | create has no --json support |
| Subcommands (`init cli`, `init mcp`, `init daemon`) | `initCommand()` L843-942 | create uses `--preset` instead |
| Standalone template validation | `validateTemplate()` L183-196 | create delegates to planner |

### 1.3 Shared Logic (Duplicated)

These functions are nearly identical between `create.ts` and `init.ts` and should be extracted to the shared engine (Slice 1) before this work:

- `BINARY_EXTENSIONS` set
- `isBinaryFile()`
- `getTemplatesDir()`
- `getOutputFilename()`
- `replacePlaceholders()`
- `copyTemplateFiles()` (create's version has additional `overwritablePaths`/`writtenPaths` params)
- `injectSharedConfig()`
- `rewriteLocalDependencies()`
- `DEPENDENCY_SECTIONS`
- `deriveProjectName()`
- `resolveYear()`
- Block addition loop (merging `AddBlockResult`)

---

## 2. Migration Matrix

### 2.1 create Flags -> init

| create flag | init equivalent | Migration |
|---|---|---|
| `-n, --name <name>` | `-n, --name <name>` | Already exists, no change |
| `-p, --preset <preset>` | `--preset <preset>` | **New flag on init** -- replaces `--template` semantically |
| `-s, --structure <mode>` | `--structure <mode>` | **New flag on init** |
| `--workspace-name <name>` | `--workspace-name <name>` | **New flag on init** |
| `--local` | `--local` | Already exists, no change |
| `--workspace` (alias for --local) | `--workspace` | Already exists, no change |
| `-f, --force` | `-f, --force` | Already exists, no change |
| `--with <blocks>` | `--with <blocks>` | Already exists, no change |
| `--no-tooling` | `--no-tooling` | Already exists, no change |
| `-y, --yes` | `-y, --yes` | **New flag on init** |

### 2.2 init Flags -- Disposition

| init flag | Disposition | Notes |
|---|---|---|
| `-n, --name <name>` | Stays | Unchanged |
| `-b, --bin <name>` | Stays | create never had this; init keeps it |
| `-t, --template <template>` | **Deprecated** | Warning + passthrough to `--preset`. Kept for one major version. |
| `-f, --force` | Stays | Unchanged |
| `--local` | Stays | Unchanged |
| `--workspace` (alias) | Stays | Unchanged |
| `--with <blocks>` | Stays | Unchanged |
| `--no-tooling` | Stays | Unchanged |
| `--json` | Stays | create never had this; init keeps it |

### 2.3 New Flags on init (from create)

| Flag | Type | Default | Description |
|---|---|---|---|
| `--preset <preset>` | `string` (enum) | `"minimal"` (was `"basic"`) | Target preset: `minimal`, `cli`, `mcp`, `daemon` |
| `--structure <mode>` | `"single" \| "workspace"` | `"single"` | Project structure |
| `--workspace-name <name>` | `string` | directory name | Workspace root package name (only when structure=workspace) |
| `-y, --yes` | `boolean` | `false` | Skip all interactive prompts, use defaults |

### 2.4 Preset/Template Mapping

| Old value | New value | Notes |
|---|---|---|
| `--template basic` | `--preset minimal` | "basic" renamed to "minimal" per plan |
| `--template cli` | `--preset cli` | Same |
| `--template mcp` | `--preset mcp` | Same |
| `--template daemon` | `--preset daemon` | Same |

When `--template` is used:
1. Emit deprecation warning: `"--template is deprecated; use --preset instead"`
2. Map `basic` -> `minimal`
3. Pass through to `--preset` logic

---

## 3. Interactive Prompts

### 3.1 Prompts in create (current)

Prompts run in order when `--yes` is not set. Each can be pre-filled via flags.

| Order | Prompt | Type | Pre-fill flag | Default |
|---|---|---|---|---|
| 1 | "Project package name" | `text` | `--name` | directory name |
| 2 | "Select a preset" | `select` | `--preset` | `basic` |
| 3 | "Project structure" | `select` | `--structure` | `single` |
| 4 | "Add default tooling blocks?" | `confirm` | `--no-tooling` | `true` |
| 5 | "Use workspace:* for @outfitter dependencies?" | `confirm` | `--local` | `false` |
| 6 | "Workspace package name" (only if structure=workspace) | `text` | `--workspace-name` | directory name |

### 3.2 Consolidated init Prompt Flow

The consolidated init will use the same prompt order, but:
- Replace "Select a preset" options with the target registry entries (ready targets only)
- Default preset changes from `basic` to `minimal`
- Add a `--bin` prompt if the preset is `cli` or `daemon` (binary targets)
- Skip prompts that subcommands implicitly answer

| Order | Prompt | Type | Pre-fill flag | Default | Skipped when |
|---|---|---|---|---|---|
| 1 | "Project package name" | `text` | `--name` | directory name | `--yes` or `--name` provided |
| 2 | "Select a preset" | `select` | `--preset` | `minimal` | `--yes`, `--preset`, or subcommand (`init cli`) |
| 3 | "Project structure" | `select` | `--structure` | `single` | `--yes` or `--structure` provided |
| 4 | "Binary name" | `text` | `--bin` | project name | `--yes`, non-binary preset, or `--bin` provided |
| 5 | "Add default tooling blocks?" | `confirm` | `--no-tooling` / `--with` | `true` | `--yes`, `--no-tooling`, or `--with` provided |
| 6 | "Use workspace:* for @outfitter dependencies?" | `confirm` | `--local` | `false` | `--yes` or `--local` provided |
| 7 | "Workspace package name" | `text` | `--workspace-name` | directory name | structure != workspace, or `--yes` |

### 3.3 Non-Interactive Flow (`--yes`)

When `--yes` is set, all prompts are skipped and defaults are used:

```
name        = --name ?? basename(targetDir)
preset      = --preset ?? "minimal"
structure   = --structure ?? "single"
bin         = --bin ?? deriveProjectName(name)
tooling     = !(--no-tooling) [default: true]
local       = --local [default: false]
workspace   = --workspace-name ?? basename(targetDir)  [only if structure=workspace]
```

### 3.4 Subcommand Behavior

Subcommands (`init cli`, `init mcp`, `init daemon`) continue to work and implicitly set `--preset`:

| Subcommand | Equivalent | Notes |
|---|---|---|
| `outfitter init cli my-app` | `outfitter init my-app --preset cli` | Subcommand sets preset, no preset prompt |
| `outfitter init mcp my-app` | `outfitter init my-app --preset mcp` | Same |
| `outfitter init daemon my-app` | `outfitter init my-app --preset daemon` | Same |
| `outfitter init my-app` | Interactive -- prompts for preset | No implicit preset |

When a subcommand is used, the preset selection prompt is skipped. All other prompts still apply
(or can be skipped with `--yes`).

---

## 4. Consolidated init Command Design

### 4.1 Full Flag/Option Specification

```
outfitter init [directory] [options]
outfitter init cli [directory] [options]
outfitter init mcp [directory] [options]
outfitter init daemon [directory] [options]
```

| Flag | Short | Type | Default | Description |
|---|---|---|---|---|
| `--name` | `-n` | `string` | dir name | Package name |
| `--bin` | `-b` | `string` | project name | Binary name (binary presets only) |
| `--preset` | `-p` | `enum` | `minimal` | Target preset |
| `--structure` | `-s` | `single\|workspace` | `single` | Project structure |
| `--workspace-name` | | `string` | dir name | Workspace root package name |
| `--local` | | `boolean` | `false` | Use workspace:* for @outfitter deps |
| `--workspace` | | `boolean` | `false` | Alias for --local |
| `--force` | `-f` | `boolean` | `false` | Overwrite existing files |
| `--with` | | `string` | | Comma-separated tooling blocks |
| `--no-tooling` | | `boolean` | `false` | Skip default tooling blocks |
| `--yes` | `-y` | `boolean` | `false` | Skip prompts, use defaults |
| `--template` | `-t` | `string` | | **DEPRECATED** -- maps to --preset |
| `--json` | | `boolean` | `false` | Force JSON output (existing, unchanged) |
| `--skip-install` | | `boolean` | `false` | Skip `bun install` after scaffolding *(added in Slice 5)* |
| `--skip-git` | | `boolean` | `false` | Skip `git init` and initial commit *(added in Slice 5)* |
| `--skip-commit` | | `boolean` | `false` | Skip initial commit only *(added in Slice 5)* |

### 4.2 Consolidated InitOptions Type

```typescript
export interface InitOptions {
  /** Target directory to initialize the project in */
  readonly targetDir: string;
  /** Package name (defaults to directory name) */
  readonly name?: string | undefined;
  /** Binary name (defaults to project name) */
  readonly bin?: string | undefined;
  /** Preset/target to scaffold (replaces template) */
  readonly preset?: InitPresetId | undefined;
  /** @deprecated Use preset instead. Maps basic->minimal, rest pass through. */
  readonly template?: string | undefined;
  /** Project structure: single package or workspace */
  readonly structure?: InitStructure | undefined;
  /** Workspace root package name (when structure=workspace) */
  readonly workspaceName?: string | undefined;
  /** Use workspace:* for @outfitter dependencies */
  readonly local?: boolean | undefined;
  /** Overwrite existing files */
  readonly force: boolean;
  /** Comma-separated tooling blocks */
  readonly with?: string | undefined;
  /** Skip default tooling blocks */
  readonly noTooling?: boolean | undefined;
  /** Skip all prompts, use defaults */
  readonly yes?: boolean | undefined;
}

export type InitStructure = "single" | "workspace";

/**
 * Init-eligible preset IDs.
 *
 * Implementation note: derive this from the target registry rather than
 * hardcoding. Use `typeof INIT_TARGET_IDS[number]` or validate at runtime
 * via `getInitTarget()`. The hardcoded union here is for pseudocode clarity
 * only — the implementation should stay in sync with the registry automatically.
 */
export type InitPresetId = "minimal" | "cli" | "mcp" | "daemon";
```

### 4.3 Consolidated InitResult Type

```typescript
export interface InitResult {
  /** Project structure used */
  readonly structure: InitStructure;
  /** Root directory (workspace root or project root) */
  readonly rootDir: string;
  /** Project directory (may differ from rootDir in workspace mode) */
  readonly projectDir: string;
  /** Preset used */
  readonly preset: InitPresetId;
  /** Package name */
  readonly packageName: string;
  /** Blocks added, if any */
  readonly blocksAdded?: AddBlockResult | undefined;
}
```

This unifies `CreateResult` (which had all these fields) with `InitResult` (which only had `blocksAdded`).

---

## 5. --template Deprecation

### 5.1 Warning Message

```
Warning: --template is deprecated and will be removed in the next major version.
  Use --preset instead: outfitter init --preset <preset>
  Mapping: --template basic -> --preset minimal
```

### 5.2 Passthrough Logic

```typescript
function resolvePreset(options: InitOptions): InitPresetId {
  // --preset takes priority
  if (options.preset) {
    return options.preset;
  }

  // --template deprecated fallback
  if (options.template) {
    emitDeprecationWarning("--template", "--preset");
    if (options.template === "basic") return "minimal";
    // Validate it's a known preset
    if (isValidPresetId(options.template)) return options.template;
    // Unknown template -- will error in validation
    return options.template as InitPresetId;
  }

  // Default (will be overridden by prompt in interactive mode)
  return "minimal";
}
```

### 5.3 Subcommand Template Override

When using subcommands (`init cli`, `init mcp`, `init daemon`), the template override
bypasses both `--preset` and `--template`. No deprecation warning is emitted because the
user never passed `--template`.

---

## 6. create Retirement Map (Slice 7)

### 6.1 All References to `create` Across the Codebase

#### Source Files

| File | Line(s) | Reference Type |
|---|---|---|
| `apps/outfitter/src/commands/create.ts` | entire file | Command implementation -- **DELETE** |
| `apps/outfitter/src/create/index.ts` | entire file | Create planner barrel -- **KEEP** (rename to target registry in Slice 0) |
| `apps/outfitter/src/create/planner.ts` | entire file | Planner logic -- **KEEP** (evolves into shared engine) |
| `apps/outfitter/src/create/presets.ts` | entire file | Preset definitions -- **KEEP** (evolves into target registry) |
| `apps/outfitter/src/create/types.ts` | entire file | Types -- **KEEP** (evolves with registry) |
| `apps/outfitter/src/actions.ts` | L28-30, L91-107, L202-231, L328-401, L810 | Action definition + registration -- **REMOVE createAction, resolveCreateOptions** |
| `apps/outfitter/src/index.ts` | L13-21, L54-65 | Public API exports -- **REMOVE create exports or alias to init** |
| `apps/outfitter/src/__tests__/create.test.ts` | entire file | Tests -- **MIGRATE to init.test.ts** |
| `apps/outfitter/src/__tests__/actions.test.ts` | L11-84 | Action mapping tests -- **MIGRATE to init action tests** |
| `apps/outfitter/src/__tests__/index.test.ts` | L17, L32-37, L46-58 | Smoke tests -- **UPDATE exports** |

#### package.json Exports

| Export path | Disposition |
|---|---|
| `./commands/create` | **REMOVE** (or keep as re-export of init for one version) |
| `./create` | **KEEP** -- target registry / planner module |
| `./create/planner` | **KEEP** |
| `./create/presets` | **KEEP** |
| `./create/types` | **KEEP** |

#### Documentation Files

| File | Reference | Action |
|---|---|---|
| `README.md` L10 | `bunx outfitter create my-project ...` | **UPDATE** to `outfitter init` |
| `apps/outfitter/README.md` L21, 39, 49-76, 197-230 | Full command reference + programmatic API | **UPDATE** -- remove create section, update init section, update API examples |
| `docs/GETTING-STARTED.md` L17 | Quick Start example | **UPDATE** to `outfitter init` |
| `docs/PILOT-KIT-FIRST-ADOPTION.md` | Multiple references | **UPDATE** all `outfitter create` -> `outfitter init` |
| `docs/ADOPTION-IA.md` L31-33, 80, 124-142 | Adoption docs | **UPDATE** |
| `AGENTS.md` | No direct `outfitter create` reference | No change needed |
| `.agents/plans/scaffold-consolidation/PLAN.md` L207 | Plan doc | Self-referential -- no update needed |

#### Plugin Files

No plugin files reference `outfitter create` as a CLI command. Generic "create" references in
fieldguide skills (`create tables`, `create plugin`) are unrelated.

### 6.2 Helpful Error Message for `outfitter create`

When someone runs `outfitter create` after retirement:

```
Error: The 'create' command has been removed.

Use 'outfitter init' instead. It supports everything 'create' did:

  Interactive mode:    outfitter init my-project
  With preset:         outfitter init my-project --preset cli
  Skip prompts:        outfitter init my-project --preset cli --yes
  Workspace:           outfitter init my-project --preset cli --structure workspace

Migration:
  outfitter create my-app --preset cli --structure single --yes
  ->  outfitter init my-app --preset cli --structure single --yes

  outfitter create my-app --preset mcp --structure workspace --workspace-name @acme/root
  ->  outfitter init my-app --preset mcp --structure workspace --workspace-name @acme/root

See 'outfitter init --help' for full options.
```

Implementation: Register a stub `create` action in the action registry that always returns
`Result.err()` with this message.

### 6.3 Test Migration

| create test | Migrated init test | Changes needed |
|---|---|---|
| "scaffolds a single-package preset" | "scaffolds a single-package preset via --preset" | Change `runCreate` -> `runInit`, add `yes: true`, map `preset` -> `preset` |
| "scaffolds a workspace layout with project under packages/" | "scaffolds a workspace layout with project under packages/" | Change `runCreate` -> `runInit`, add `yes: true` |
| "supports local workspace dependency rewriting" | "supports local workspace dependency rewriting (workspace mode)" | Already tested in init for single mode; add workspace variant |
| "does not overwrite existing template files without force" | Already covered by init force tests | Verify coverage |
| "stamps manifest with blocks after successful create" | "stamps manifest with blocks after successful init (workspace)" | Test workspace manifest path |
| "does not create manifest when noTooling is true" | Already covered by init test | Verify coverage |
| "stamps manifest in project directory for workspace layout" | "stamps manifest in project directory for workspace layout" | Direct migration |
| "stamps manifest with custom blocks from --with flag" | Already covered by init test | Verify coverage |

Action mapping tests (`actions.test.ts`):

| create action test | Migrated test | Changes |
|---|---|---|
| "maps create --no-tooling to noTooling=true" | "maps init --no-tooling to noTooling=true" | Change action id `"create"` -> `"init"` |
| "maps create --tooling to noTooling=false" | "maps init --tooling to noTooling=false" | Same |
| "does not force create noTooling when flag omitted" | "does not force init noTooling when flag omitted" | Same |
| "preserves create local as undefined" | "preserves init local as undefined" | Same |
| "maps create local/workspace aliases" | "maps init local/workspace aliases" | Same |

### 6.4 Draft Changeset Entry

```markdown
---
"outfitter": minor
---

### `outfitter create` retired in favor of `outfitter init`

**What changed**: The `create` command has been removed. `outfitter init` now handles
both interactive and non-interactive project creation, including workspace scaffolding.

**Who is affected**: Anyone using `outfitter create` in scripts, documentation, or
muscle memory.

**Required action**: required

**Detection hint**: `grep -r "outfitter create" scripts/ docs/ .github/`

**Rewrite guidance**:
- `outfitter create my-app --preset cli --yes` -> `outfitter init my-app --preset cli --yes`
- `outfitter create my-app --structure workspace` -> `outfitter init my-app --structure workspace`
- `runCreate(options)` -> `runInit(options)` (programmatic API)
- `import { runCreate } from "outfitter"` -> `import { runInit } from "outfitter"`

**Verification steps**:
1. Run `outfitter init my-test --preset cli --yes` and verify project scaffolds correctly
2. Run `outfitter create` and verify helpful migration error appears
3. Check CI scripts for any `outfitter create` invocations
```

---

## 7. Pseudocode

### 7.1 `runInit()` -- Consolidated Handler

```typescript
export async function runInit(
  options: InitOptions
): Promise<Result<InitResult, InitError>> {
  const resolvedTargetDir = resolve(options.targetDir);

  // 1. Handle --template deprecation
  const presetFromFlags = resolvePresetFromFlags(options);

  // 2. Resolve all input (interactive or flag-driven)
  const inputResult = await resolveInitInput({
    ...options,
    resolvedTargetDir,
    presetFromFlags,
  });
  if (inputResult.isErr()) return inputResult;
  const input = inputResult.value;

  // 3. Determine project directory based on structure and target placement
  //    Note: this differs from current create.ts which hardcodes "packages/".
  //    Per Decision 7, runnable targets go in apps/, libraries in packages/.
  const targetResult = getInitTarget(input.preset);
  if (targetResult.isErr()) {
    return Result.err(new InitError(targetResult.error.message));
  }
  const target = targetResult.value;
  const projectDir = input.structure === "workspace"
    ? join(input.rootDir, resolvePlacement(target), deriveProjectName(input.packageName))
    : input.rootDir;

  // 4. Check for existing files
  if (input.structure === "single") {
    if (hasPackageJson(input.rootDir) && !options.force) {
      return Result.err(new InitError(
        `Directory '${input.rootDir}' already has a package.json. ` +
        `Use --force to overwrite, or use 'outfitter add' for existing projects.`
      ));
    }
  }

  // 5. Build plan via planner (uses target registry after Slice 0)
  const planResult = planCreateProject({
    name: input.packageName,
    targetDir: projectDir,
    preset: mapPresetToLegacy(input.preset),  // bridge until planner uses registry
    includeTooling: input.includeTooling,
    local: input.local,
    year: resolveYear(),
  });
  if (planResult.isErr()) {
    return Result.err(new InitError(planResult.error.message));
  }

  const plan = applyBlockOverrides(planResult.value, input.blocksOverride);

  // 6. Scaffold workspace root if needed
  if (input.structure === "workspace") {
    const workspaceName = input.workspaceName || basename(input.rootDir);
    const wsResult = scaffoldWorkspaceRoot(
      input.rootDir,
      workspaceName,
      deriveProjectName(input.packageName),
      options.force,
    );
    if (wsResult.isErr()) return wsResult;
  }

  // 7. Execute plan (shared engine after Slice 1)
  const execResult = await executePlan(plan, options.force);
  if (execResult.isErr()) return execResult;

  // 8. Return consolidated result
  return Result.ok({
    structure: input.structure,
    rootDir: input.rootDir,
    projectDir,
    preset: input.preset,
    packageName: input.packageName,
    blocksAdded: execResult.value,
  });
}
```

### 7.2 `resolveInitInput()` -- Merging Interactive + Flag-Driven + Subcommand Paths

```typescript
interface ResolvedInitInput {
  readonly rootDir: string;
  readonly packageName: string;
  readonly preset: InitPresetId;
  readonly structure: InitStructure;
  readonly binName?: string;
  readonly includeTooling: boolean;
  readonly blocksOverride?: readonly string[];
  readonly workspaceName?: string;
  readonly local: boolean;
}

interface ResolveInitInputOptions extends InitOptions {
  readonly resolvedTargetDir: string;
  readonly presetFromFlags: InitPresetId | undefined;
  /** Set by subcommand handlers to lock preset without prompting */
  readonly presetOverride?: InitPresetId | undefined;
}

async function resolveInitInput(
  options: ResolveInitInputOptions
): Promise<Result<ResolvedInitInput, InitError>> {
  const rootDir = options.resolvedTargetDir;
  const defaultName = basename(rootDir);

  // ── Non-interactive path ──────────────────────────────────────────
  if (options.yes) {
    const packageName = (options.name ?? defaultName).trim();
    if (packageName.length === 0) {
      return Result.err(new InitError("Project name must not be empty"));
    }

    const preset = options.presetOverride
      ?? options.presetFromFlags
      ?? "minimal";
    const structure = options.structure ?? "single";
    const blocksOverride = parseBlocks(options.with);
    const workspaceName = structure === "workspace"
      ? (options.workspaceName ?? defaultName).trim() || defaultName
      : undefined;

    return Result.ok({
      rootDir,
      packageName,
      preset,
      structure,
      includeTooling: !(options.noTooling ?? false),
      local: Boolean(options.local),
      ...(options.bin ? { binName: options.bin } : {}),
      ...(blocksOverride ? { blocksOverride } : {}),
      ...(workspaceName ? { workspaceName } : {}),
    });
  }

  // ── Interactive path ──────────────────────────────────────────────
  intro("Outfitter init");

  // Prompt 1: Package name
  const packageNameValue = options.name
    ?? await promptText({
      message: "Project package name",
      placeholder: defaultName,
      initialValue: defaultName,
      validate: nonEmpty("Project name is required"),
    });
  if (isCancelled(packageNameValue)) return cancelledResult();

  // Prompt 2: Preset (skipped if subcommand or --preset flag)
  const presetValue = options.presetOverride
    ?? options.presetFromFlags
    ?? await promptSelect<InitPresetId>({
      message: "Select a preset",
      options: getReadyTargets().map(t => ({
        value: t.id,
        label: t.id,
        hint: t.description,
      })),
      initialValue: "minimal",
    });
  if (isCancelled(presetValue)) return cancelledResult();

  // Prompt 3: Structure
  const structureValue = options.structure
    ?? await promptSelect<InitStructure>({
      message: "Project structure",
      options: [
        { value: "single", label: "Single package", hint: "One package in the target directory" },
        { value: "workspace", label: "Workspace", hint: "Root workspace with project under packages/" },
      ],
      initialValue: "single",
    });
  if (isCancelled(structureValue)) return cancelledResult();

  // Prompt 4: Bin name (only for binary presets)
  let binName: string | undefined;
  const isBinaryPreset = ["cli", "daemon"].includes(presetValue);
  if (isBinaryPreset) {
    const projectName = deriveProjectName(packageNameValue.trim());
    binName = options.bin
      ?? await promptText({
        message: "Binary name",
        placeholder: projectName,
        initialValue: projectName,
      });
    if (isCancelled(binName)) return cancelledResult();
  }

  // Prompt 5: Tooling
  const includeTooling = options.noTooling !== undefined
    ? !options.noTooling
    : options.with !== undefined
      ? true  // --with implies tooling
      : await promptConfirm({
          message: "Add default tooling blocks?",
          initialValue: true,
        });
  if (isCancelled(includeTooling)) return cancelledResult();

  // Prompt 6: Local dependencies
  const localValue = options.local !== undefined
    ? options.local
    : await promptConfirm({
        message: "Use workspace:* for @outfitter dependencies?",
        initialValue: false,
      });
  if (isCancelled(localValue)) return cancelledResult();

  // Prompt 7: Workspace name (only if workspace structure)
  let workspaceName: string | undefined;
  if (structureValue === "workspace") {
    workspaceName = options.workspaceName
      ?? await promptText({
        message: "Workspace package name",
        placeholder: defaultName,
        initialValue: defaultName,
        validate: nonEmpty("Workspace name is required"),
      });
    if (isCancelled(workspaceName)) return cancelledResult();
    workspaceName = workspaceName.trim();
  }

  outro("Scaffolding project...");

  const packageName = packageNameValue.trim();
  if (packageName.length === 0) {
    return Result.err(new InitError("Project name must not be empty"));
  }

  const blocksOverride = parseBlocks(options.with);

  return Result.ok({
    rootDir,
    packageName,
    preset: presetValue,
    structure: structureValue,
    includeTooling: Boolean(includeTooling),
    local: Boolean(localValue),
    ...(binName ? { binName: binName.trim() } : {}),
    ...(blocksOverride ? { blocksOverride } : {}),
    ...(workspaceName ? { workspaceName } : {}),
  });
}
```

### 7.3 `mapPresetToLegacy()` -- Bridge to Existing Planner

The planner (`create/planner.ts`) currently expects `CreatePresetId` ("basic" | "cli" | "mcp" |
"daemon"). Until the planner is migrated to consume the target registry directly (Slice 0
adoption), this bridge function maps the new `InitPresetId` to the legacy type:

```typescript
import type { CreatePresetId } from "../create/presets.js";

function mapPresetToLegacy(preset: InitPresetId): CreatePresetId {
  if (preset === "minimal") return "basic";
  return preset; // "cli", "mcp", "daemon" pass through unchanged
}
```

This function is temporary. After Slice 0 lands and the planner is updated to use
`TargetDefinition` directly, `mapPresetToLegacy` is removed and `planCreateProject` accepts a
`TargetId` instead of `CreatePresetId`.

### 7.4 Deprecation Warning for `--template`

```typescript
function resolvePresetFromFlags(options: InitOptions): InitPresetId | undefined {
  // --preset takes priority
  if (options.preset) {
    return options.preset;
  }

  // --template: deprecated passthrough
  if (options.template) {
    const mapped = options.template === "basic" ? "minimal" : options.template;

    // Emit deprecation warning to stderr (does not affect JSON output)
    console.error(
      `Warning: --template is deprecated and will be removed in the next major version.\n` +
      `  Use --preset instead: outfitter init --preset ${mapped}\n` +
      (options.template === "basic"
        ? `  Note: "basic" has been renamed to "minimal".\n`
        : "")
    );

    // Validate the mapped value
    if (isValidPresetId(mapped)) {
      return mapped;
    }

    // If it's not a valid preset, let it through -- validation will catch it later
    return mapped as InitPresetId;
  }

  return undefined;
}

function isValidPresetId(value: string): value is InitPresetId {
  return ["minimal", "cli", "mcp", "daemon"].includes(value);
}
```

### 7.5 `create` -> `init` Redirect Error Handler

```typescript
// In actions.ts, replace the createAction with a redirect stub

const createRedirectAction = defineAction({
  id: "create",
  description: "Removed -- use 'outfitter init' instead",
  surfaces: ["cli"],
  input: z.object({}).passthrough(),
  cli: {
    command: "create [directory]",
    description: "Removed -- use 'outfitter init' instead",
    options: [],
    mapInput: () => ({}),
  },
  handler: async () => {
    const message = [
      "The 'create' command has been removed.",
      "",
      "Use 'outfitter init' instead. It supports everything 'create' did:",
      "",
      "  Interactive mode:    outfitter init my-project",
      "  With preset:         outfitter init my-project --preset cli",
      "  Skip prompts:        outfitter init my-project --preset cli --yes",
      "  Workspace:           outfitter init my-project --preset cli --structure workspace",
      "",
      "See 'outfitter init --help' for full options.",
    ].join("\n");

    return Result.err(
      new InternalError({
        message,
        context: { action: "create" },
      })
    );
  },
});
```

---

## 8. Action Registry Changes

### 8.1 Current init Actions

```
init           -> resolveInitOptions(context)            -> runInit()
init.cli       -> resolveInitOptions(context, "cli")     -> runInit()
init.mcp       -> resolveInitOptions(context, "mcp")     -> runInit()
init.daemon    -> resolveInitOptions(context, "daemon")  -> runInit()
```

### 8.2 Consolidated init Actions

The action factory needs updating to:

1. Add new flags (`--preset`, `--structure`, `--workspace-name`, `--yes`) to all init actions
2. The base `init` action includes `--template` (deprecated) and `--preset`
3. Subcommand actions (`init.cli`, etc.) set `presetOverride` and omit `--preset`/`--template`

```typescript
function createConsolidatedInitAction(options: {
  id: string;
  description: string;
  command: string;
  presetOverride?: InitPresetId;
  includePresetOption: boolean;
  includeTemplateOption: boolean;
}) {
  const actionOptions: ActionCliOption[] = [
    ...commonInitOptions,               // name, bin, force, local, workspace, with, no-tooling
    structureOption,                     // NEW: --structure
    workspaceNameOption,                 // NEW: --workspace-name
    yesOption,                           // NEW: --yes
  ];

  if (options.includePresetOption) {
    actionOptions.push(presetOption);    // NEW: --preset
  }
  if (options.includeTemplateOption) {
    actionOptions.push(templateOption);  // DEPRECATED: --template
  }

  return defineAction({
    id: options.id,
    description: options.description,
    surfaces: ["cli"],
    input: consolidatedInitInputSchema,
    cli: {
      group: "init",
      command: options.command,
      description: options.description,
      options: actionOptions,
      mapInput: (context) => resolveConsolidatedInitOptions(
        context,
        options.presetOverride,
      ),
    },
    handler: async (input) => {
      const { outputMode, ...initInput } = input;
      const outputOptions = outputMode ? { mode: outputMode } : undefined;
      const result = await runInit(initInput);
      if (result.isErr()) {
        return Result.err(new InternalError({
          message: result.error.message,
          context: { action: options.id },
        }));
      }
      await printInitResults(result.value, outputOptions);
      return Result.ok(result.value);
    },
  });
}

// Registration:
outfitterActions
  .add(createConsolidatedInitAction({
    id: "init",
    description: "Create a new Outfitter project",
    command: "[directory]",
    includePresetOption: true,
    includeTemplateOption: true,  // deprecated, kept for compat
  }))
  .add(createConsolidatedInitAction({
    id: "init.cli",
    description: "Create a new CLI project",
    command: "cli [directory]",
    presetOverride: "cli",
    includePresetOption: false,
    includeTemplateOption: false,
  }))
  .add(createConsolidatedInitAction({
    id: "init.mcp",
    description: "Create a new MCP server",
    command: "mcp [directory]",
    presetOverride: "mcp",
    includePresetOption: false,
    includeTemplateOption: false,
  }))
  .add(createConsolidatedInitAction({
    id: "init.daemon",
    description: "Create a new daemon project",
    command: "daemon [directory]",
    presetOverride: "daemon",
    includePresetOption: false,
    includeTemplateOption: false,
  }));
```

---

## 9. Dependency on Prior Slices

This slice (2) depends on Slice 1 (shared engine) completing first. Specifically:

- Shared engine must export: `copyTemplateFiles`, `replacePlaceholders`, `isBinaryFile`,
  `getTemplatesDir`, `injectSharedConfig`, `rewriteLocalDependencies`, `addBlocks`
- `runInit` will import from the shared engine instead of defining these locally
- The `executePlan` function from `create.ts` should already be in the shared engine
- The `scaffoldWorkspaceRoot` function from `create.ts` should already be in the shared engine

If Slice 1 is not yet complete, the consolidation can still proceed by:
1. Copying the workspace scaffolding functions from `create.ts` into `init.ts` temporarily
2. Marking them with `// TODO: extract to shared engine in Slice 1` comments
3. Replacing after Slice 1 lands

The `create` command itself remains untouched in this slice. Retirement happens in Slice 7.

### Breaking API Changes in This Slice

1. **`printInitResults` signature change**: The current signature is
   `printInitResults(targetDir: string, result: InitResult, options?)`. The consolidated
   `InitResult` includes `rootDir` and `projectDir`, making the separate `targetDir` parameter
   redundant. Update to `printInitResults(result: InitResult, options?)` and update the action
   handler in `actions.ts` accordingly.

2. **`mapPresetToLegacy` is NOT needed**: Per the Slice 1 update, the planner is migrated to
   accept `TargetDefinition` directly in Slice 1. The `mapPresetToLegacy` bridge is unnecessary.
   Instead, pass the resolved `TargetDefinition` from `getInitTarget()` directly to the planner.

### Known Divergence: `init` vs `create` Workspace Placement

During the transition period (Slices 2-7), `init --structure workspace --preset cli` places
CLIs in `apps/` (per Decision 7 and the target registry), while `create --structure workspace
--preset cli` continues to place everything in `packages/` (hardcoded in `create.ts`). This is
intentional — `create` is unchanged until retirement in Slice 7. Do not attempt to "fix" create
to match init during this period.

---

## 10. Verification Checklist

After this slice is complete, all of the following must pass:

- [ ] `outfitter init my-app` -- launches interactive flow, prompts for preset/structure
- [ ] `outfitter init my-app --preset cli --yes` -- non-interactive, single package
- [ ] `outfitter init my-app --preset mcp --structure workspace --yes` -- workspace mode
- [ ] `outfitter init cli my-app --yes` -- subcommand preset override
- [ ] `outfitter init my-app --template cli --yes` -- deprecation warning, works correctly
- [ ] `outfitter init my-app --template basic --yes` -- maps to `minimal`, warns
- [ ] `outfitter init my-app --preset cli --structure workspace --workspace-name @acme/root --yes` -- full workspace
- [ ] `outfitter init my-app --preset cli -b my-bin --yes` -- custom binary name
- [ ] `outfitter init my-app --preset cli --no-tooling --yes` -- no blocks added
- [ ] `outfitter init my-app --preset cli --with claude,biome --yes` -- custom blocks
- [ ] `outfitter init my-app --preset cli --local --yes` -- workspace:* rewriting
- [ ] `outfitter create` -- **still works** (not yet retired, untouched in this slice)
- [ ] All existing `init.test.ts` tests pass without modification
- [ ] All create test scenarios have equivalent init tests
- [ ] JSON output mode works for all paths
