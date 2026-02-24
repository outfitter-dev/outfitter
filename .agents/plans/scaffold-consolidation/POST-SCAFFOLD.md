# Post-Scaffold Automation & Dry-Run Design

**Status**: Draft
**Last Updated**: 2026-02-12
**Covers**: Slices 5 (Post-Scaffold Automation) and 6 (Dry Run) from PLAN.md

## 1. Existing Behavior Analysis

### What happens after files are written today

**`init` command** (`apps/outfitter/src/commands/init.ts`):

- `runInit()` returns `Result<InitResult, InitError>` where `InitResult` contains only `blocksAdded`
- No dependency installation (`bun install`) runs
- No git initialization runs
- `printInitResults()` renders a summary and hardcoded "Next steps: bun install, bun run dev"
- JSON mode outputs a structured object with `nextSteps: ["bun install", "bun run dev"]`

**`create` command** (`apps/outfitter/src/commands/create.ts`):

- `runCreate()` returns `Result<CreateResult, CreateError>` with structure, rootDir, projectDir, preset, packageName, blocksAdded
- No dependency installation runs
- No git initialization runs
- `printCreateResults()` renders summary and hardcoded next-steps (workspace-aware: `bun run --cwd <projectDir> dev`)
- JSON mode outputs `nextSteps: ["bun install", "bun run build", "bun run test"]`

**`add` command** (`apps/outfitter/src/commands/add.ts`):

- Has a `dryRun: boolean` field on `AddInput` -- the only existing dry-run support
- When `dryRun` is true: file existence checks still run (so created/skipped/overwritten are accurate), but `writeFile()` calls are skipped and `updatePackageJson()` skips writes and `stampBlock()` is skipped
- `printAddResults()` prefixes output with `[dry-run] Would` when dry-run is active
- JSON output includes `dryRun: boolean` field

**Summary of gaps**:

1. No post-scaffold automation exists anywhere -- users must manually run `bun install` and `git init`
2. Dry-run exists only in `add`, not in `init` or `create`
3. Next-steps are hardcoded strings, not derived from what was actually scaffolded
4. No operation collection -- `add`'s dry-run works by conditionally skipping writes inline, not by collecting a plan

### Manifest system

The manifest (`apps/outfitter/src/manifest.ts`) tracks installed blocks at `.outfitter/manifest.json`. It uses read-modify-write via `stampBlock()`. The manifest is stamped after block files are written in `add.ts` (line 380). This is a best-effort operation -- failures log to stderr but don't fail the command.

### CLI rendering primitives available

From `@outfitter/cli`:

- `output()` -- mode-aware output (human/json/jsonl) with backpressure
- `exitWithError()` -- error formatting + exit code mapping
- `renderList()` -- bullet/number/checkbox/dash lists with nesting
- `renderTree()` -- unicode box-drawing tree rendering
- `INDICATORS` -- status symbols (success/error/warning/info), markers, progress
- `getIndicator()` -- unicode-aware indicator selection
- Colors via `createTheme()` / `createTokens()` / `ANSI`

## 2. Post-Scaffold Automation Design

### Overview

A `runPostScaffold()` function orchestrates dependency installation, git bootstrapping, and next-steps display. It runs after both `init` and `scaffold` commands complete their file operations. Each phase is independently failable -- a failure in `bun install` must not prevent git init or next-steps from running.

### Types

```typescript
/** Which command triggered post-scaffold */
type ScaffoldOrigin = "init" | "scaffold";

/**
 * Target type for context-aware next-steps.
 *
 * Implementation note: import `TargetId` from `../targets/index.js` instead
 * of redefining this union. Shown inline here for readability only.
 */
type PostScaffoldTargetId = TargetId; // = "minimal" | "cli" | "mcp" | ... from target registry

interface PostScaffoldOptions {
  /** Absolute path to the project root (where bun install runs) */
  readonly rootDir: string;
  /** Absolute path to the scaffolded package (may differ from rootDir in workspaces) */
  readonly projectDir: string;
  /** Which command triggered this */
  readonly origin: ScaffoldOrigin;
  /** Target type for next-steps tailoring */
  readonly target: PostScaffoldTargetId;
  /** Project structure */
  readonly structure: "single" | "workspace";
  /** Whether the project was converted from single to workspace (scaffold only) */
  readonly convertedToWorkspace?: boolean;
  /** Skip dependency installation */
  readonly skipInstall: boolean;
  /** Skip git initialization and initial commit */
  readonly skipGit: boolean;
  /** Skip initial commit only (git init still runs) */
  readonly skipCommit: boolean;
  /** Output mode for rendering */
  readonly mode?: OutputMode;
  /** Whether this is a dry-run (collect operations, don't execute) */
  readonly dryRun: boolean;
}

interface PostScaffoldResult {
  /** Whether bun install succeeded (null if skipped) */
  readonly installResult: "success" | "failed" | "skipped";
  /** Install failure message, if any */
  readonly installError?: string;
  /** Whether git init ran (null if skipped) */
  readonly gitInitResult: "success" | "failed" | "skipped" | "already-repo";
  /** Whether initial commit was created */
  readonly gitCommitResult: "success" | "failed" | "skipped";
  /** Git failure message, if any */
  readonly gitError?: string;
  /** Tailored next-steps for the user */
  readonly nextSteps: readonly string[];
}
```

### `runPostScaffold()` pseudocode

```typescript
async function runPostScaffold(
  options: PostScaffoldOptions,
  collector?: OperationCollector
): Promise<Result<PostScaffoldResult, never>> {
  // Phase 1: Dependency installation
  let installResult: PostScaffoldResult["installResult"] = "skipped";
  let installError: string | undefined;

  if (!options.skipInstall) {
    if (options.dryRun) {
      collector?.add({
        type: "install",
        command: "bun install",
        cwd: options.rootDir,
      });
      installResult = "skipped"; // dry-run: report as skipped
    } else {
      const result = await runBunInstall(options.rootDir);
      if (result.isOk()) {
        installResult = "success";
      } else {
        installResult = "failed";
        installError = result.error;
        // Log warning but continue -- install failure is non-fatal
        process.stderr.write(`Warning: bun install failed: ${result.error}\n`);
      }
    }
  }

  // Phase 2: Git bootstrap (init-only by default)
  let gitInitResult: PostScaffoldResult["gitInitResult"] = "skipped";
  let gitCommitResult: PostScaffoldResult["gitCommitResult"] = "skipped";
  let gitError: string | undefined;

  if (!options.skipGit && options.origin === "init") {
    const gitState = detectGitState(options.rootDir);

    if (options.dryRun) {
      if (!gitState.isRepo) {
        collector?.add({ type: "git", action: "init", cwd: options.rootDir });
      }
      if (!options.skipCommit) {
        collector?.add({
          type: "git",
          action: "add-all",
          cwd: options.rootDir,
        });
        collector?.add({
          type: "git",
          action: "commit",
          message: "init: scaffold with outfitter",
          cwd: options.rootDir,
        });
      }
      gitInitResult = gitState.isRepo ? "already-repo" : "skipped";
    } else {
      if (gitState.isRepo) {
        gitInitResult = "already-repo";
      } else {
        const initResult = await runGitInit(options.rootDir);
        gitInitResult = initResult.isOk() ? "success" : "failed";
        if (initResult.isErr()) {
          gitError = initResult.error;
          process.stderr.write(
            `Warning: git init failed: ${initResult.error}\n`
          );
        }
      }

      // Only commit if git init succeeded or was already a repo
      if (
        !options.skipCommit &&
        (gitInitResult === "success" || gitInitResult === "already-repo")
      ) {
        const commitResult = await runGitCommit(
          options.rootDir,
          "init: scaffold with outfitter"
        );
        gitCommitResult = commitResult.isOk() ? "success" : "failed";
        if (commitResult.isErr()) {
          gitError = commitResult.error;
          process.stderr.write(
            `Warning: git commit failed: ${commitResult.error}\n`
          );
        }
      }
    }
  }

  // Phase 3: Compute next-steps
  const nextSteps = computeNextSteps(options, {
    installResult,
    gitInitResult,
  });

  return Result.ok({
    installResult,
    installError,
    gitInitResult,
    gitCommitResult,
    gitError,
    nextSteps,
  });
}
```

### `detectGitState()` pseudocode

```typescript
interface GitState {
  /** Whether the directory is inside a git repository */
  readonly isRepo: boolean;
  /** The git root directory, if in a repo */
  readonly gitRoot?: string;
  /** Whether there are uncommitted changes */
  readonly hasChanges?: boolean;
}

function detectGitState(dir: string): GitState {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode !== 0) {
      return { isRepo: false };
    }

    const gitRoot = result.stdout.toString().trim();

    // Check for uncommitted changes
    const statusResult = Bun.spawnSync(["git", "status", "--porcelain"], {
      cwd: dir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const hasChanges =
      statusResult.exitCode === 0 &&
      statusResult.stdout.toString().trim().length > 0;

    return { isRepo: true, gitRoot, hasChanges };
  } catch {
    return { isRepo: false };
  }
}
```

### Shell command helpers

```typescript
async function runBunInstall(cwd: string): Promise<Result<void, string>> {
  try {
    const proc = Bun.spawn(["bun", "install"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return Result.err(
        stderr.trim() || `bun install exited with code ${exitCode}`
      );
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}

async function runGitInit(cwd: string): Promise<Result<void, string>> {
  try {
    const result = Bun.spawnSync(["git", "init"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode !== 0) {
      return Result.err(result.stderr.toString().trim());
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}

async function runGitCommit(
  cwd: string,
  message: string
): Promise<Result<void, string>> {
  try {
    // Stage all files
    const addResult = Bun.spawnSync(["git", "add", "."], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (addResult.exitCode !== 0) {
      return Result.err(
        `git add failed: ${addResult.stderr.toString().trim()}`
      );
    }

    // Create commit
    const commitResult = Bun.spawnSync(["git", "commit", "-m", message], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (commitResult.exitCode !== 0) {
      return Result.err(
        `git commit failed: ${commitResult.stderr.toString().trim()}`
      );
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}
```

### `renderNextSteps()` pseudocode

Next-steps are computed based on context, not hardcoded. They account for what automation already ran and what the user needs to do manually.

```typescript
function computeNextSteps(
  options: PostScaffoldOptions,
  results: { installResult: string; gitInitResult: string }
): readonly string[] {
  const steps: string[] = [];
  const isWorkspace = options.structure === "workspace";
  const relativeProjectDir = isWorkspace
    ? path.relative(options.rootDir, options.projectDir)
    : ".";

  // Step 1: cd into the project (only if init created a new directory)
  if (options.origin === "init") {
    const dirName = path.basename(options.rootDir);
    steps.push(`cd ${dirName}`);
  }

  // Step 2: Install dependencies (only if install was skipped or failed)
  if (results.installResult !== "success") {
    steps.push("bun install");
  }

  // Step 3: Target-specific dev command
  if (isWorkspace) {
    steps.push(`bun run --cwd ${relativeProjectDir} dev`);
  } else {
    steps.push("bun run dev");
  }

  // Step 4: Target-specific hints
  switch (options.target) {
    case "mcp":
      steps.push("# Configure your MCP tools in src/tools/");
      break;
    case "cli":
      steps.push("# Add commands in src/commands/");
      break;
    case "daemon":
      steps.push("# Configure daemon in src/daemon.ts");
      break;
    case "api":
      steps.push("# Add routes in src/routes/");
      break;
    case "lib":
      steps.push("# Export your public API from src/index.ts");
      break;
    case "minimal":
    case "worker":
    case "web":
      // No special hints for these targets yet
      break;
  }

  return steps;
}
```

### `renderNextSteps()` output format

Human mode:

```
Next steps:
  cd my-project
  bun run dev
  # Add commands in src/commands/
```

JSON mode (included in the parent result object):

```json
{
  "nextSteps": [
    "cd my-project",
    "bun run dev",
    "# Add commands in src/commands/"
  ]
}
```

### Flag specification

| Flag                | Applies to         | Default | Description                                                    |
| ------------------- | ------------------ | ------- | -------------------------------------------------------------- |
| `--skip-install`    | `init`, `scaffold` | `false` | Skip `bun install` after scaffolding                           |
| `--install-timeout` | `init`, `scaffold` | `60000` | Timeout for `bun install` in ms. Warn and continue on timeout. |
| `--skip-git`        | `init` only        | `false` | Skip both `git init` and initial commit                        |
| `--skip-commit`     | `init` only        | `false` | Run `git init` but skip the initial commit                     |

`scaffold` does not run git init/commit because it operates inside an existing project. It may add a targeted `git add` of the new files in the future, but that is out of scope for Slice 5.

### Error resilience model

Each phase is wrapped in its own try/catch. Failures are:

1. Reported to stderr immediately (human-readable warning)
2. Recorded in `PostScaffoldResult` for programmatic consumers
3. Non-blocking -- the next phase always runs

This means a user always sees their next-steps, even if install and git both fail. The result object lets automation detect partial success.

```
Warning: bun install failed: ENOSPC
Warning: git init failed: git not found

Project initialized successfully in /home/user/my-project

Next steps:
  cd my-project
  bun install
  bun run dev
```

Notice that "bun install" appears in next-steps because the install failed. If it had succeeded, that line would be omitted.

## 3. Dry-Run System Design

### Philosophy

The dry-run system uses an **operation collector** pattern rather than the inline-conditional approach used in `add.ts` today. The collector accumulates a plan of all operations that would execute, then renders the plan without side effects.

This is cleaner than the inline approach because:

1. The engine code does not need `if (!dryRun)` scattered throughout
2. The operation plan is a first-class data structure that can be rendered, serialized, or diffed
3. It naturally composes across init + scaffold + post-scaffold

### Operation types

```typescript
type Operation =
  | {
      type: "file-create";
      path: string;
      source: "template" | "block" | "generated";
    }
  | {
      type: "file-overwrite";
      path: string;
      source: "template" | "block" | "generated";
    }
  | { type: "file-skip"; path: string; reason: string }
  | { type: "dir-create"; path: string }
  | {
      type: "dependency-add";
      name: string;
      version: string;
      section: "dependencies" | "devDependencies" | "peerDependencies";
    }
  | { type: "dependency-skip"; name: string; reason: string }
  | { type: "block-add"; name: string; files: readonly string[] }
  | { type: "config-inject"; target: string; description: string }
  | {
      type: "git";
      action: "init" | "add-all" | "commit";
      message?: string;
      cwd: string;
    }
  | { type: "install"; command: string; cwd: string }
  | { type: "manifest-stamp"; block: string; version: string };
```

### `OperationCollector` class

```typescript
class OperationCollector {
  private readonly operations: Operation[] = [];

  /** Add an operation to the plan */
  add(op: Operation): void {
    this.operations.push(op);
  }

  /** Get all collected operations */
  getOperations(): readonly Operation[] {
    return this.operations;
  }

  /** Count operations by type */
  countByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const op of this.operations) {
      counts[op.type] = (counts[op.type] ?? 0) + 1;
    }
    return counts;
  }

  /** Get all file paths that would be created or overwritten */
  getAffectedPaths(): readonly string[] {
    return this.operations
      .filter((op) => op.type === "file-create" || op.type === "file-overwrite")
      .map((op) => (op as { path: string }).path);
  }

  /** Check if the collector has any operations */
  isEmpty(): boolean {
    return this.operations.length === 0;
  }

  /** Convert to a JSON-serializable structure */
  toJSON(): {
    operations: readonly Operation[];
    summary: Record<string, number>;
  } {
    return {
      operations: this.operations,
      summary: this.countByType(),
    };
  }
}
```

### How the engine switches between execute and collect mode

The shared scaffolding engine (Slice 1) accepts an optional `OperationCollector`. When present, it records operations instead of executing them. This is threaded through all engine functions:

```typescript
/**
 * EngineOptions is defined in engine/types.ts (Slice 1). In Slice 6,
 * the `collector` field is added to it:
 */
interface EngineOptions {
  readonly force: boolean;
  /** Added in Slice 6: when present, collect operations instead of executing */
  readonly collector?: OperationCollector;
}

function isCollecting(ctx: EngineOptions): boolean {
  return ctx.collector !== undefined;
}
```

The pattern in engine functions:

```typescript
function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  values: PlaceholderValues,
  ctx: EngineOptions
): Result<void, ScaffoldError> {
  // ... iterate entries ...

  for (const entry of entries) {
    const targetPath = join(targetDir, outputFilename);
    const exists = existsSync(targetPath);

    if (isCollecting(ctx)) {
      // Dry-run: record what would happen
      if (exists && !ctx.force) {
        ctx.collector!.add({
          type: "file-skip",
          path: targetPath,
          reason: "exists",
        });
      } else if (exists) {
        ctx.collector!.add({
          type: "file-overwrite",
          path: targetPath,
          source: "template",
        });
      } else {
        ctx.collector!.add({
          type: "file-create",
          path: targetPath,
          source: "template",
        });
      }
      continue;
    }

    // Execute mode: write the file
    // ... existing write logic ...
  }
}
```

Similarly for `runAdd` when invoked from the engine:

```typescript
async function addBlocks(
  targetDir: string,
  blocks: readonly string[],
  ctx: EngineOptions
): Promise<Result<AddBlockResult, ScaffoldError>> {
  for (const blockName of blocks) {
    if (isCollecting(ctx)) {
      // Resolve the block to know what files it would create
      const blockResult = resolveBlock(registry, blockName);
      if (blockResult.isErr()) return blockResult;

      const block = blockResult.value;
      const files = block.files?.map((f) => f.path) ?? [];
      ctx.collector!.add({ type: "block-add", name: blockName, files });

      // Also record individual file operations
      for (const file of block.files ?? []) {
        const targetPath = join(targetDir, file.path);
        const exists = existsSync(targetPath);
        if (exists && !ctx.force) {
          ctx.collector!.add({
            type: "file-skip",
            path: targetPath,
            reason: "exists",
          });
        } else if (exists) {
          ctx.collector!.add({
            type: "file-overwrite",
            path: targetPath,
            source: "block",
          });
        } else {
          ctx.collector!.add({
            type: "file-create",
            path: targetPath,
            source: "block",
          });
        }
      }

      // Record dependency additions
      for (const [name, version] of Object.entries(block.dependencies ?? {})) {
        ctx.collector!.add({
          type: "dependency-add",
          name,
          version,
          section: "dependencies",
        });
      }
      for (const [name, version] of Object.entries(
        block.devDependencies ?? {}
      )) {
        ctx.collector!.add({
          type: "dependency-add",
          name,
          version,
          section: "devDependencies",
        });
      }

      ctx.collector!.add({
        type: "manifest-stamp",
        block: blockName,
        version: toolingVersion,
      });

      continue;
    }

    // Execute mode: run the add
    const result = await runAdd({
      block: blockName,
      force: ctx.force,
      dryRun: false,
      cwd: targetDir,
    });
    // ...
  }
}
```

### `renderOperationPlan()` -- human-readable output

```typescript
async function renderOperationPlan(
  collector: OperationCollector,
  options?: { mode?: OutputMode; rootDir?: string }
): Promise<void> {
  const ops = collector.getOperations();
  const mode = options?.mode;
  const rootDir = options?.rootDir ?? process.cwd();

  // JSON mode: structured output
  if (mode === "json" || mode === "jsonl") {
    await output(collector.toJSON(), { mode });
    return;
  }

  // Human mode: grouped by operation category
  const lines: string[] = ["[dry-run] Operation plan:", ""];

  // Group 1: Files
  const fileCreates = ops.filter((op) => op.type === "file-create") as Array<
    Extract<Operation, { type: "file-create" }>
  >;
  const fileOverwrites = ops.filter(
    (op) => op.type === "file-overwrite"
  ) as Array<Extract<Operation, { type: "file-overwrite" }>>;
  const fileSkips = ops.filter((op) => op.type === "file-skip") as Array<
    Extract<Operation, { type: "file-skip" }>
  >;

  if (fileCreates.length > 0) {
    lines.push(`  Create ${fileCreates.length} file(s):`);
    for (const op of fileCreates) {
      const rel = path.relative(rootDir, op.path);
      lines.push(`    + ${rel}`);
    }
    lines.push("");
  }

  if (fileOverwrites.length > 0) {
    lines.push(`  Overwrite ${fileOverwrites.length} file(s):`);
    for (const op of fileOverwrites) {
      const rel = path.relative(rootDir, op.path);
      lines.push(`    ~ ${rel}`);
    }
    lines.push("");
  }

  if (fileSkips.length > 0) {
    lines.push(`  Skip ${fileSkips.length} file(s):`);
    for (const op of fileSkips) {
      const rel = path.relative(rootDir, op.path);
      lines.push(`    - ${rel} (${op.reason})`);
    }
    lines.push("");
  }

  // Group 2: Dependencies
  const depAdds = ops.filter((op) => op.type === "dependency-add") as Array<
    Extract<Operation, { type: "dependency-add" }>
  >;

  if (depAdds.length > 0) {
    lines.push(`  Add ${depAdds.length} dependency(ies):`);
    for (const op of depAdds) {
      const suffix = op.section === "devDependencies" ? " (dev)" : "";
      lines.push(`    + ${op.name}@${op.version}${suffix}`);
    }
    lines.push("");
  }

  // Group 3: Blocks
  const blockAdds = ops.filter((op) => op.type === "block-add") as Array<
    Extract<Operation, { type: "block-add" }>
  >;

  if (blockAdds.length > 0) {
    lines.push(`  Add ${blockAdds.length} block(s):`);
    for (const op of blockAdds) {
      lines.push(`    + ${op.name} (${op.files.length} files)`);
    }
    lines.push("");
  }

  // Group 4: Post-scaffold actions
  const gitOps = ops.filter((op) => op.type === "git");
  const installOps = ops.filter((op) => op.type === "install");

  if (installOps.length > 0 || gitOps.length > 0) {
    lines.push("  Post-scaffold:");
    for (const op of installOps) {
      lines.push(
        `    $ ${(op as Extract<Operation, { type: "install" }>).command}`
      );
    }
    for (const op of gitOps) {
      const gitOp = op as Extract<Operation, { type: "git" }>;
      if (gitOp.action === "init") {
        lines.push("    $ git init");
      } else if (gitOp.action === "add-all") {
        lines.push("    $ git add .");
      } else if (gitOp.action === "commit") {
        lines.push(`    $ git commit -m "${gitOp.message}"`);
      }
    }
    lines.push("");
  }

  // Summary line
  const summary = collector.countByType();
  const parts: string[] = [];
  if (summary["file-create"]) parts.push(`${summary["file-create"]} create`);
  if (summary["file-overwrite"])
    parts.push(`${summary["file-overwrite"]} overwrite`);
  if (summary["file-skip"]) parts.push(`${summary["file-skip"]} skip`);
  if (summary["dependency-add"])
    parts.push(`${summary["dependency-add"]} deps`);

  if (parts.length > 0) {
    lines.push(`  Total: ${parts.join(", ")}`);
  }

  await output(lines);
}
```

### Example human output

```
[dry-run] Operation plan:

  Create 12 file(s):
    + package.json
    + tsconfig.json
    + src/index.ts
    + src/program.ts
    + .gitignore
    + .lefthook.yml
    + .claude/settings.json
    + biome.json
    + scripts/bootstrap.sh
    + .outfitter/manifest.json
    + README.md
    + LICENSE

  Add 6 dependency(ies):
    + @biomejs/biome@^2.3.12 (dev)
    + @outfitter/tooling@^0.2.1 (dev)
    + @types/bun@^1.3.7 (dev)
    + lefthook@^2.0.16 (dev)
    + typescript@^5.9.3 (dev)
    + ultracite@^7.1.1 (dev)

  Add 1 block(s):
    + scaffolding (8 files)

  Post-scaffold:
    $ bun install
    $ git init
    $ git add .
    $ git commit -m "init: scaffold with outfitter"

  Total: 12 create, 6 deps
```

### Example JSON output

```json
{
  "operations": [
    {
      "type": "file-create",
      "path": "/abs/path/package.json",
      "source": "template"
    },
    {
      "type": "file-create",
      "path": "/abs/path/tsconfig.json",
      "source": "template"
    },
    {
      "type": "dependency-add",
      "name": "@biomejs/biome",
      "version": "^2.3.12",
      "section": "devDependencies"
    },
    {
      "type": "block-add",
      "name": "scaffolding",
      "files": [".claude/settings.json", "biome.json", "..."]
    },
    { "type": "install", "command": "bun install", "cwd": "/abs/path" },
    { "type": "git", "action": "init", "cwd": "/abs/path" },
    {
      "type": "git",
      "action": "commit",
      "message": "init: scaffold with outfitter",
      "cwd": "/abs/path"
    },
    { "type": "manifest-stamp", "block": "scaffolding", "version": "0.2.1" }
  ],
  "summary": {
    "file-create": 12,
    "dependency-add": 6,
    "block-add": 1,
    "install": 1,
    "git": 3,
    "manifest-stamp": 1
  }
}
```

## 4. Integration Points

### Where post-scaffold runs in the flow

```
init command
  |
  v
resolveInput()          -- gather user options
  |
  v
runInit() / engine      -- template copy, config inject, blocks
  |
  v
runPostScaffold()       -- bun install, git init, git commit  <-- NEW
  |
  v
printResults()          -- summary + next-steps (uses PostScaffoldResult)
```

```
scaffold command
  |
  v
detectProject()         -- find existing project structure
  |
  v
engine                  -- template copy into workspace slot
  |
  v
runPostScaffold()       -- bun install only (no git)  <-- NEW
  |
  v
printResults()          -- summary + next-steps
```

### How dry-run flag propagates

The `--dry-run` flag is parsed at the CLI command level and flows through the entire stack:

```
CLI flag: --dry-run
  |
  v
Command handler creates OperationCollector (if dry-run)
  |
  v
Engine receives collector via EngineOptions
  |  |  |
  |  |  +-> copyTemplateFiles(ctx)    -- records file ops
  |  +----> injectSharedConfig(ctx)    -- records config ops
  +-------> addBlocks(ctx)             -- records block/dep ops
  |
  v
runPostScaffold(options, collector)    -- records install/git ops
  |
  v
renderOperationPlan(collector)         -- instead of printResults()
```

The command handler looks like this:

```typescript
// In init command action handler
const dryRun = Boolean(flags.dryRun);
const collector = dryRun ? new OperationCollector() : undefined;

const ctx: EngineOptions = { collector, force: Boolean(flags.force) };

if (dryRun) {
  // Run engine in collect mode
  const engineResult = await runEngine(resolvedInput, ctx);
  if (engineResult.isErr()) {
    exitWithError(engineResult.error, outputOptions);
  }

  // Run post-scaffold in collect mode
  await runPostScaffold({ ...postScaffoldOptions, dryRun: true }, collector);

  // Render the plan
  await renderOperationPlan(collector!, { mode, rootDir });
} else {
  // Execute mode (existing flow)
  const engineResult = await runEngine(resolvedInput, ctx);
  if (engineResult.isErr()) {
    exitWithError(engineResult.error, outputOptions);
  }

  const postResult = await runPostScaffold(postScaffoldOptions);
  await printResults(engineResult.value, postResult.value, outputOptions);
}
```

### Reusing patterns from `add`

The existing `add` command's dry-run can be migrated to use `OperationCollector` in a backward-compatible way. The `runAdd` function already has a `dryRun` boolean; the refactored version would accept an optional collector:

```typescript
// Current signature (preserved for backward compat)
export async function runAdd(
  input: AddInput
): Promise<Result<AddBlockResult, AddError>>;

// Internal: engine calls this with collector
export async function runAddWithCollector(
  input: Omit<AddInput, "dryRun">,
  collector?: OperationCollector
): Promise<Result<AddBlockResult, AddError>>;
```

However, for Slice 6 we keep the existing `runAdd` working as-is. The collector integration happens only when `add` is called from the engine (e.g., `addBlocks` in `create.ts`). Direct `outfitter add` invocations continue using the existing inline dry-run approach until a later cleanup pass.

## 5. File Placement

All new code lives in the outfitter app:

| File                                                 | Purpose                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `apps/outfitter/src/engine/post-scaffold.ts`         | `runPostScaffold()`, shell helpers, `computeNextSteps()` |
| `apps/outfitter/src/engine/git.ts`                   | `detectGitState()`, `runGitInit()`, `runGitCommit()`     |
| `apps/outfitter/src/engine/collector.ts`             | `OperationCollector` class, `Operation` type             |
| `apps/outfitter/src/engine/render-plan.ts`           | `renderOperationPlan()`                                  |
| `apps/outfitter/src/__tests__/post-scaffold.test.ts` | Post-scaffold automation tests                           |
| `apps/outfitter/src/__tests__/collector.test.ts`     | Operation collector tests                                |
| `apps/outfitter/src/__tests__/render-plan.test.ts`   | Dry-run rendering tests                                  |

The engine directory is established in Slice 1 (shared engine extraction). Slices 5 and 6 add to it.

## 6. Testing Strategy

### Post-scaffold tests (Slice 5)

```
post-scaffold.test.ts
  runPostScaffold()
    - runs bun install by default (mock Bun.spawn)
    - skips install when --skip-install is set
    - reports install failure but continues to git and next-steps
    - runs git init + commit for init origin
    - skips git for scaffold origin
    - skips git when --skip-git is set
    - skips commit only when --skip-commit is set
    - detects existing repo and skips git init but still commits
    - reports git failure but continues to next-steps

  computeNextSteps()
    - includes "bun install" when install was skipped
    - omits "bun install" when install succeeded
    - includes workspace-aware dev command
    - includes target-specific hints (mcp, cli, daemon, etc.)
    - includes "cd <dir>" for init origin

  detectGitState()
    - returns isRepo: true inside a git repo
    - returns isRepo: false outside a git repo
    - reports gitRoot correctly
    - handles git not installed gracefully
```

### Collector tests (Slice 6)

```
collector.test.ts
  OperationCollector
    - starts empty
    - accumulates operations
    - countByType returns correct counts
    - getAffectedPaths returns create and overwrite paths
    - toJSON produces serializable structure

render-plan.test.ts
  renderOperationPlan()
    - renders file creates with + prefix
    - renders file overwrites with ~ prefix
    - renders file skips with - prefix and reason
    - renders dependencies with section labels
    - renders blocks with file count
    - renders post-scaffold commands
    - renders summary line
    - produces valid JSON in json mode
    - produces empty output for empty collector
```

### Integration tests

```
dry-run-integration.test.ts
  init --dry-run
    - produces no filesystem changes
    - operation plan matches actual init file list
    - includes post-scaffold operations (install, git)
    - JSON output is parseable and complete
    - --skip-install omits install from plan
    - --skip-git omits git from plan
```

## 7. Migration Path for Existing `add` Dry-Run

The `add` command's inline dry-run approach works today and does not need to change for Slices 5-6. The migration to `OperationCollector` can happen in a follow-up cleanup:

1. **Slice 5-6**: `OperationCollector` is used by the engine for `init` and `scaffold` dry-run. When the engine calls `addBlocks()`, it either uses the collector or calls `runAdd` directly.
2. **Future cleanup**: `runAdd` gains an optional collector parameter. The `--dry-run` flag on `outfitter add` creates a collector, passes it through, and renders with `renderOperationPlan`. The old inline approach is removed.

This keeps the scope of Slices 5-6 bounded while establishing the pattern for later adoption.

## 8. Resolved Questions

1. **Install timeout**: Yes, 60-second default. Add `--install-timeout <ms>` flag to override for slow
   networks or large monorepos. On timeout, warn and continue to next-steps output.
2. **Git user config**: Detect upfront via `git config user.name`. If missing, skip the initial commit
   with a message pointing the user to `git config --global user.name "..."`.
3. **Scaffold post-scaffold hooks**: Deferred to a later slice. No current template needs one, and the
   hook system is orthogonal to install/git automation. Keep Slice 5 focused.
4. **Lockfile in git**: Yes, commit `bun.lock` when `bun install` runs. Standard practice for
   reproducible installs. When `--skip-install` is set, no lockfile exists to commit.
