# Scaffold Command Design

**Status**: Draft
**Last Updated**: 2026-02-12
**Parent**: [PLAN.md](./PLAN.md) (Slices 3-4)

This document covers the detailed design for `outfitter scaffold`, including project detection,
workspace auto-conversion, and post-scaffold hooks. It maps to Slices 3 (Scaffold Command), 4
(Workspace Conversion), and 5 (Post-Scaffold Automation) from the plan.

---

## 1. Command Signature

```
outfitter scaffold <target> [name]
```

### Arguments

| Argument | Required | Default   | Description                                                                      |
| -------- | -------- | --------- | -------------------------------------------------------------------------------- |
| `target` | Yes      | --        | Target type from registry (cli, mcp, daemon, api, worker, web, lib)              |
| `name`   | No       | Target id | Package directory name. For scoped names (`@org/foo`), the directory uses `foo`. |

### Flags

| Flag              | Short | Type    | Default        | Description                                        |
| ----------------- | ----- | ------- | -------------- | -------------------------------------------------- |
| `--force`         | `-f`  | boolean | `false`        | Overwrite existing files                           |
| `--skip-install`  | --    | boolean | `false`        | Skip `bun install` after scaffolding               |
| `--dry-run`       | --    | boolean | `false`        | Show what would happen without executing (Slice 6) |
| `--with <blocks>` | --    | string  | Target default | Comma-separated tooling blocks to add              |
| `--no-tooling`    | --    | boolean | `false`        | Skip default tooling blocks for the target         |
| `--local`         | --    | boolean | `false`        | Use `workspace:*` for `@outfitter` dependencies    |
| `--json`          | --    | boolean | `false`        | Output as JSON                                     |

### Examples

```bash
# Add MCP server to existing project (auto-converts to workspace if single-package)
outfitter scaffold mcp

# Add library with custom name
outfitter scaffold lib shared-utils

# Add CLI with specific tooling blocks
outfitter scaffold cli --with biome,lefthook

# Preview what would happen
outfitter scaffold daemon --dry-run
```

### Not-a-scaffold: `minimal`

The `minimal` target is init-only and cannot be scaffolded into an existing project. The scaffold
command rejects it with a clear error: `"minimal" is a starting point, not a scaffold target. Use
"outfitter init" to create a new project.`

---

## 2. Project Structure Detection

Before scaffolding, the command must understand what it is operating on. There are three
possible states:

### 2.1 Detection States

```typescript
type ProjectStructure =
  | {
      readonly kind: "workspace";
      readonly rootDir: string;
      readonly workspacePatterns: readonly string[];
    }
  | {
      readonly kind: "single-package";
      readonly rootDir: string;
      readonly packageJson: PackageJsonData;
    }
  | { readonly kind: "none" };
```

| State              | Detection                                                                                 | Next Step                                       |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **workspace**      | `package.json` with `workspaces` field found (walking up from cwd)                        | Scaffold directly into workspace                |
| **single-package** | `package.json` exists at cwd but no `workspaces` field, and no workspace root found above | Auto-convert to workspace, then scaffold        |
| **none**           | No `package.json` found at cwd or above                                                   | Auto-adopt flow: create manifest, then scaffold |

### 2.2 Detection Algorithm

The command reuses `detectWorkspaceRoot()` from `update-workspace.ts` as the foundation, but
adds a layer of interpretation:

```
detectProjectStructure(cwd: string):
  1. Read package.json at cwd
     - If not found: return { kind: "none" }
  2. Check if cwd's package.json has `workspaces` field
     - If yes: return { kind: "workspace", rootDir: cwd, ... }
  3. Walk up from cwd using detectWorkspaceRoot()
     - If workspace root found above: return { kind: "workspace", rootDir: root, ... }
  4. Return { kind: "single-package", rootDir: cwd, packageJson: parsed }
```

### 2.3 Reuse of `detectWorkspaceRoot`

The existing `detectWorkspaceRoot()` in `apps/outfitter/src/commands/update-workspace.ts`
already handles:

- Walking up from cwd
- Checking for `workspaces` field in package.json (both array and object formats)
- Checking for `pnpm-workspace.yaml`
- Stopping at filesystem root

This function is currently in `update-workspace.ts` but should be extracted to a shared location
(the shared engine from Slice 1) since both `scaffold` and `update` need it.

---

## 3. Auto-Adopt Flow (Non-Outfitter Projects)

When `detectProjectStructure` returns `{ kind: "none" }`, the project has no package.json.
The scaffold command creates one as part of the operation.

```
autoAdoptFlow(cwd: string, target: TargetDefinition, name: string):
  1. Create minimal package.json at cwd:
     {
       "name": name,
       "version": "0.1.0",
       "private": true,
       "type": "module"
     }
  2. Create .outfitter/manifest.json (empty, version 1)
  3. Continue with single-package detection (which will trigger workspace conversion)
```

This is intentionally minimal. The scaffold flow then picks up the project as a single-package
and proceeds with workspace conversion if needed.

If a `package.json` exists but has no Outfitter manifest (`.outfitter/manifest.json`), the
project is still treated as a valid project. The manifest is created on first scaffold.

---

## 4. Target Resolution

### 4.1 Registry Lookup

The scaffold command reads from the target registry (Slice 0). Every target has:

The scaffold command uses `TargetDefinition` from the target registry (Slice 0, see
TARGET-REGISTRY.md for the canonical type). The relevant fields for scaffold resolution are
`templateDir`, `status`, `scope`, `category`, and `placement`.

### 4.2 Resolution Steps

The scaffold command uses `getScaffoldTarget()` from the registry, which handles all validation:

```
resolveTarget(targetId: string):
  1. Look up targetId in registry via getScaffoldTarget()
  2. If not found: return err("Unknown scaffold target '<id>'. Available: cli, mcp, ...")
  3. If status === "stub": return err("'<id>' is not yet available. Ready targets: ...")
  4. If scope === "init-only": return err("'<id>' is a starting point, not a scaffold target. Use 'outfitter init'.")
  5. Return ok(target)
```

### 4.3 Placement Rules

| Category                                        | Placement          | Rationale                                       |
| ----------------------------------------------- | ------------------ | ----------------------------------------------- |
| `runnable` (cli, mcp, daemon, api, worker, web) | `apps/<name>/`     | Has entrypoint, runs independently              |
| `library` (lib)                                 | `packages/<name>/` | Consumed by other packages, no direct execution |

---

## 5. Scaffold Into Existing Workspace

When the project is already a workspace, scaffolding is straightforward:

### 5.1 Algorithm

```
scaffoldIntoWorkspace(rootDir: string, target: TargetDefinition, name: string, options: ScaffoldOptions):
  1. Determine placement directory:
     placementDir = target.placement  // "apps" or "packages"
     targetDir = join(rootDir, placementDir, name)

  2. Check for conflicts:
     - If targetDir exists and !options.force:
       return err("'<placementDir>/<name>/' already exists. Use --force to overwrite.")
     - If targetDir exists and options.force:
       warn("Overwriting existing <placementDir>/<name>/")

  3. Ensure placement directory is in workspace patterns:
     - Read rootDir/package.json
     - Check if workspaces array includes pattern matching "<placementDir>/*"
     - If not, add it and write back

  4. Run template engine:
     - Resolve template directory from target.templateDir
     - Compute placeholder values (name, packageName, version, year, etc.)
     - When scaffolding into workspace, SKIP root-level files:
       - .gitignore (workspace root owns this)
       - biome.json at root (workspace root owns this)
       - .lefthook.yml (workspace root owns this)
       - tsconfig.json is NOT skipped (each package needs its own)
     - Copy template files to targetDir with placeholder replacement
     - Inject shared config (devDependencies, scripts)

  5. Wire up workspace dependencies:
     - Read the new package's package.json
     - Rewrite @outfitter/* deps to workspace:* if --local
     - Do NOT automatically add cross-references between workspace packages
       (user decides inter-package dependencies)

  6. Add tooling blocks:
     - Resolve blocks from --with or target.defaultBlocks
     - Run addBlocks(targetDir, blocks, force)

  7. Run post-scaffold hook (if exists):
     - Check for template/<target>/hooks/post-scaffold.ts
     - If found, execute it with context { rootDir, targetDir, name, target }

  8. Return scaffold result
```

### 5.2 Workspace Pattern Maintenance

When scaffolding into a workspace, the root package.json's `workspaces` array must cover the
new package's location. The command checks and updates patterns:

```
ensureWorkspacePattern(rootDir: string, placementDir: "apps" | "packages"):
  1. Read root package.json
  2. Parse workspaces field
  3. Check if any existing pattern would match "<placementDir>/*"
     Common patterns: ["apps/*", "packages/*"], ["packages/*"]
  4. If not covered:
     - Add "<placementDir>/*" to workspaces array
     - Write updated package.json
     - Log: "Added '<placementDir>/*' to workspace patterns"
```

---

## 6. Workspace Auto-Conversion

The most complex flow: converting a single-package project to a workspace so a second package
can be scaffolded alongside it.

### 6.1 Category Detection for Existing Package

Before moving the existing package, we need to determine its category to know whether it goes
into `apps/` or `packages/`.

```
detectExistingCategory(packageJson: PackageJsonData): "runnable" | "library"
  1. If packageJson.bin exists and is non-empty: return "runnable"
  2. If packageJson has @modelcontextprotocol/sdk in dependencies: return "runnable"
  3. Default: return "library"
```

Detection is deliberately narrow — only `bin` field and known framework dependencies trigger
"runnable". Script-based heuristics (checking for "start", "serve", etc.) are intentionally
excluded because they produce false positives (e.g., a library with a `"dev": "bun --watch"` script).

The safe default is "library" since libraries in `packages/` can still be run, but a runnable
in `packages/` may not be discovered by workspace tooling. If the heuristic is wrong, the user
can move the directory. The workspace conversion output makes the decision visible.

### 6.2 Conversion Algorithm

```
convertToWorkspace(
  rootDir: string,
  existingPkg: PackageJsonData,
  target: TargetDefinition,
  scaffoldName: string,
  options: ScaffoldOptions
): Result<ConversionResult, ScaffoldError>

  1. SAFETY CHECK: Ensure rootDir is not inside another workspace
     - Walk up from dirname(rootDir) using detectWorkspaceRoot
     - If found: return err("Cannot convert — already inside workspace at '<path>'")

  2. Determine existing package's placement:
     existingCategory = detectExistingCategory(existingPkg)
     existingPlacement = existingCategory === "runnable" ? "apps" : "packages"
     existingName = deriveProjectName(existingPkg.name ?? basename(rootDir))

  3. Determine new package's placement:
     newPlacement = target.placement  // "apps" or "packages"

  4. Collect files to move:
     - List all files/dirs in rootDir EXCEPT:
       - .git/
       - node_modules/
       - .outfitter/ (stays at workspace root)
       - bun.lock (regenerated)
     - These files constitute the existing package

  5. Create workspace structure:
     a. Create temporary staging directory (sibling to rootDir):
        stagingDir = join(dirname(rootDir), `.outfitter-staging-${pid}`)
        mkdir(stagingDir)

     b. Move existing package files to staging:
        For each file/dir in rootDir (from step 4):
          move file/dir -> stagingDir/

     c. Create workspace directories:
        mkdir(rootDir/apps)     // if needed
        mkdir(rootDir/packages) // if needed

     d. Move staged files to final location:
        finalDir = join(rootDir, existingPlacement, existingName)
        move stagingDir -> finalDir

     e. Create workspace root package.json:
        {
          "name": existingName + "-workspace",  // or basename(rootDir)
          "private": true,
          "version": "0.1.0",
          "workspaces": ["apps/*", "packages/*"],
          "scripts": {
            "build": "bun run --filter '*' build",
            "test": "bun run --filter '*' test",
            "typecheck": "bun run --filter '*' typecheck",
            "lint": "bun run --filter '*' lint",
            "lint:fix": "bun run --filter '*' lint:fix",
            "format": "bun run --filter '*' format"
          }
        }

     f. Create/update workspace root .gitignore:
        Merge existing .gitignore content (if it existed in old root)
        with workspace-standard entries (node_modules, **/dist)

     g. If .outfitter/ existed, it stays in rootDir (already there)

  6. Update existing package's references:
     - tsconfig.json paths: no changes needed (relative within package)
     - package.json: no changes needed (it moves as-is)
     - Import paths: no changes needed (relative imports stay valid)
     - The only thing that changes is the package's location on disk

  7. Scaffold new target into workspace:
     scaffoldIntoWorkspace(rootDir, target, scaffoldName, options)

  8. Return conversion result with summary
```

### 6.3 File Movement Strategy

The conversion uses a staging directory to make the operation atomic-ish. If something fails
mid-conversion, the staging directory still contains the original files and can be moved back.

Why staging instead of in-place renames:

- Avoids conflicts between source and destination within the same directory tree
- Makes rollback possible: if step 5e fails, move staging back to rootDir
- Node.js `fs.rename()` is atomic within the same filesystem

**Cross-device fallback**: `renameSync` throws `EXDEV` when source and destination are on
different filesystems (e.g., Docker bind mounts, symlinked dirs). The implementation must
catch `EXDEV` and fall back to recursive copy + delete. Alternatively, place the staging
directory inside `rootDir` itself (e.g., `rootDir/.outfitter-staging-*`) to guarantee
same-filesystem operation, then add `.outfitter-staging-*` to `.gitignore`.

### 6.4 Recovery from Partial Failure

```
recoverConversion(rootDir: string, stagingDir: string):
  1. If stagingDir exists:
     a. List contents of rootDir
     b. Remove any workspace structure created (apps/, packages/, root package.json)
     c. Move all files from stagingDir back to rootDir
     d. Remove stagingDir
     e. Log: "Conversion rolled back. Project restored to original state."
  2. If stagingDir does not exist:
     a. No recovery possible from staging
     b. Log: "Cannot auto-recover. Check git status for recovery."
```

The staging-based approach means partial failures are recoverable as long as the staging
directory has not been removed.

### 6.5 Workspace Root package.json Design

The workspace root package.json differs from the existing `buildWorkspaceRootPackageJson` in
`create.ts` in several ways:

| Concern    | Current (create.ts)               | New (scaffold)                             |
| ---------- | --------------------------------- | ------------------------------------------ |
| Workspaces | `["packages/*"]` only             | `["apps/*", "packages/*"]`                 |
| Scripts    | Point to single `packages/<name>` | Use `--filter '*'` for all packages        |
| Name       | User-provided workspace name      | Derived from existing package or directory |

The new version is more general because it supports both `apps/` and `packages/` from the start.

---

## 7. Post-Scaffold Hooks

Each target can include an optional post-scaffold hook script. The engine looks for it at a
conventional path within the template directory.

### 7.1 Hook Location

```
templates/<target>/hooks/post-scaffold.ts
```

### 7.2 Hook Contract

```typescript
interface PostScaffoldContext {
  /** Workspace root directory */
  readonly rootDir: string;
  /** Directory where this target was scaffolded */
  readonly targetDir: string;
  /** Package name */
  readonly name: string;
  /** Target definition from registry */
  readonly target: TargetDefinition;
  /** Whether this was a workspace conversion */
  readonly converted: boolean;
}

/** Hook function signature */
type PostScaffoldHook = (
  ctx: PostScaffoldContext
) => Promise<Result<void, Error>>;
```

### 7.3 Hook Execution

```
runPostScaffoldHook(templateDir: string, ctx: PostScaffoldContext):
  1. hookPath = join(templateDir, "hooks", "post-scaffold.ts")
  2. If not exists: return ok(undefined) — hooks are optional
  3. Import hook module dynamically: await import(hookPath)
  4. Call exported default function with ctx
  5. If hook returns err: log warning but do not fail the scaffold
     (hooks are best-effort, not blocking)
```

### 7.4 Example Hooks

**MCP target**: Could generate a default tool registration file:

```typescript
// templates/mcp/hooks/post-scaffold.ts
export default async function (ctx: PostScaffoldContext) {
  // Register a sample tool in the MCP action registry
}
```

**Daemon target**: Could set up systemd/launchd service template:

```typescript
// templates/daemon/hooks/post-scaffold.ts
export default async function (ctx: PostScaffoldContext) {
  // Create a platform-appropriate service definition
}
```

---

## 8. Template Mode-Aware Application

Templates are shared between `init` (standalone project) and `scaffold` (into workspace). The
engine needs to behave differently in each mode.

### 8.1 Files Skipped in Workspace Mode

When scaffolding into a workspace, these root-level files from the template are skipped because
the workspace root owns them:

| File                           | Reason                                 |
| ------------------------------ | -------------------------------------- |
| `.gitignore`                   | Workspace root has its own             |
| `.lefthook.yml`                | Git hooks configured at workspace root |
| `biome.json` (root-level only) | Workspace root has shared biome config |

Files that are NOT skipped:

- `package.json` — each package needs its own
- `tsconfig.json` — each package needs its own
- `src/` and all subdirectories — the package's source code
- `README.md` — each package can have documentation

### 8.2 Implementation

The template engine accepts a `mode` parameter:

```typescript
type ScaffoldMode = "standalone" | "workspace-member";

function shouldSkipFile(relativePath: string, mode: ScaffoldMode): boolean {
  if (mode === "standalone") return false;

  const WORKSPACE_SKIP = new Set([
    ".gitignore",
    ".gitignore.template",
    ".lefthook.yml",
    ".lefthook.yml.template",
    "biome.json",
    "biome.json.template",
  ]);

  // Only skip root-level config files, not nested ones
  if (!relativePath.includes("/") && WORKSPACE_SKIP.has(relativePath)) {
    return true;
  }

  return false;
}
```

---

## 9. Handler Pseudocode

### 9.1 `runScaffold()` -- Main Handler

```typescript
interface ScaffoldOptions {
  readonly target: string;
  readonly name?: string;
  readonly force: boolean;
  readonly skipInstall: boolean;
  readonly dryRun: boolean;
  readonly withBlocks?: string;
  readonly noTooling?: boolean;
  readonly local?: boolean;
  readonly cwd: string;
}

/** Named ScaffoldCommandResult to avoid collision with engine's ScaffoldResult */
interface ScaffoldCommandResult {
  readonly target: TargetDefinition;
  readonly targetDir: string;
  readonly rootDir: string;
  readonly converted: boolean;
  readonly movedExisting?: {
    readonly from: string;
    readonly to: string;
    readonly name: string;
  };
  readonly workspacePatternsUpdated: boolean;
  readonly blocksAdded?: AddBlockResult;
  readonly postScaffoldHookRan: boolean;
}

async function runScaffold(
  options: ScaffoldOptions
): Promise<Result<ScaffoldCommandResult, ScaffoldError>> {
  // 1. Resolve target from registry
  const targetResult = resolveTarget(options.target);
  if (targetResult.isErr()) return targetResult;
  const target = targetResult.value;

  // 2. Resolve name (default to target id)
  const name = options.name ?? target.id;
  const projectName = deriveProjectName(name); // strip @scope/ if present

  // 3. Detect project structure
  const structure = await detectProjectStructure(options.cwd);

  // 4. Branch on structure
  let rootDir: string;
  let converted = false;
  let movedExisting: ScaffoldCommandResult["movedExisting"] | undefined;

  switch (structure.kind) {
    case "none": {
      // Auto-adopt: create package.json, then treat as single-package
      const adoptResult = await autoAdopt(options.cwd, name);
      if (adoptResult.isErr()) return adoptResult;

      // Re-detect — now it should be single-package
      const redetected = await detectProjectStructure(options.cwd);
      if (redetected.kind !== "single-package") {
        return Result.err(new ScaffoldError("Failed to initialize project"));
      }

      // Fall through to single-package conversion
      const conversionResult = await convertToWorkspace(
        redetected.rootDir,
        redetected.packageJson,
        target,
        projectName,
        options
      );
      if (conversionResult.isErr()) return conversionResult;
      rootDir = redetected.rootDir;
      converted = true;
      movedExisting = conversionResult.value.movedExisting;
      break;
    }

    case "single-package": {
      // Convert to workspace, then scaffold
      const conversionResult = await convertToWorkspace(
        structure.rootDir,
        structure.packageJson,
        target,
        projectName,
        options
      );
      if (conversionResult.isErr()) return conversionResult;
      rootDir = structure.rootDir;
      converted = true;
      movedExisting = conversionResult.value.movedExisting;
      break;
    }

    case "workspace": {
      // Scaffold directly into workspace
      rootDir = structure.rootDir;
      break;
    }
  }

  // 5. Scaffold target into workspace
  const scaffoldResult = await scaffoldIntoWorkspace(
    rootDir,
    target,
    projectName,
    options
  );
  if (scaffoldResult.isErr()) return scaffoldResult;

  // 6. Post-scaffold: bun install
  if (!options.skipInstall && !options.dryRun) {
    const installResult = await runInstall(rootDir);
    if (installResult.isErr()) {
      // Warn but don't fail — installation issues shouldn't block output
      console.warn(
        `Warning: bun install failed: ${installResult.error.message}`
      );
    }
  }

  // 7. Return result
  return Result.ok({
    target,
    targetDir: scaffoldResult.value.targetDir,
    rootDir,
    converted,
    movedExisting,
    workspacePatternsUpdated: scaffoldResult.value.patternsUpdated,
    blocksAdded: scaffoldResult.value.blocksAdded,
    postScaffoldHookRan: scaffoldResult.value.hookRan,
  });
}
```

### 9.2 `detectProjectStructure()`

```typescript
interface PackageJsonData {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly workspaces?: string[] | { packages?: string[] };
  readonly bin?: Record<string, string> | string;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

type ProjectStructure =
  | {
      readonly kind: "workspace";
      readonly rootDir: string;
      readonly workspacePatterns: readonly string[];
    }
  | {
      readonly kind: "single-package";
      readonly rootDir: string;
      readonly packageJson: PackageJsonData;
    }
  | { readonly kind: "none" };

function detectProjectStructure(
  cwd: string
): Result<ProjectStructure, ScaffoldError> {
  const resolvedCwd = resolve(cwd);
  const pkgPath = join(resolvedCwd, "package.json");

  // No package.json at cwd
  if (!existsSync(pkgPath)) {
    // Check if we're inside a workspace (e.g., in a subdirectory)
    const wsResult = detectWorkspaceRoot(resolvedCwd);
    if (wsResult.isOk() && wsResult.value !== null) {
      const rootPkgPath = join(wsResult.value, "package.json");
      const rootPkg = readPackageJson(rootPkgPath);
      if (rootPkg && hasWorkspacesField(rootPkg)) {
        return Result.ok({
          kind: "workspace",
          rootDir: wsResult.value,
          workspacePatterns: extractWorkspacePatterns(rootPkg),
        });
      }
    }
    return Result.ok({ kind: "none" });
  }

  // package.json exists at cwd
  const pkg = readPackageJson(pkgPath);
  if (!pkg) {
    return Result.err(new ScaffoldError("Failed to parse package.json"));
  }

  // Check if cwd IS a workspace root
  if (hasWorkspacesField(pkg)) {
    return Result.ok({
      kind: "workspace",
      rootDir: resolvedCwd,
      workspacePatterns: extractWorkspacePatterns(pkg),
    });
  }

  // Check if cwd is inside a workspace
  const wsResult = detectWorkspaceRoot(resolvedCwd);
  if (
    wsResult.isOk() &&
    wsResult.value !== null &&
    wsResult.value !== resolvedCwd
  ) {
    const rootPkgPath = join(wsResult.value, "package.json");
    const rootPkg = readPackageJson(rootPkgPath);
    if (rootPkg && hasWorkspacesField(rootPkg)) {
      return Result.ok({
        kind: "workspace",
        rootDir: wsResult.value,
        workspacePatterns: extractWorkspacePatterns(rootPkg),
      });
    }
  }

  // Single package (has package.json but no workspace)
  return Result.ok({
    kind: "single-package",
    rootDir: resolvedCwd,
    packageJson: pkg,
  });
}
```

### 9.3 `convertToWorkspace()`

```typescript
interface ConversionResult {
  readonly movedExisting: {
    readonly from: string;
    readonly to: string;
    readonly name: string;
  };
}

async function convertToWorkspace(
  rootDir: string,
  existingPkg: PackageJsonData,
  target: TargetDefinition,
  scaffoldName: string,
  options: ScaffoldOptions
): Promise<Result<ConversionResult, ScaffoldError>> {
  // 1. Safety: ensure we're not inside another workspace
  const parentWs = detectWorkspaceRoot(dirname(rootDir));
  if (parentWs.isOk() && parentWs.value !== null) {
    return Result.err(
      new ScaffoldError(
        `Cannot convert to workspace: already inside workspace at '${parentWs.value}'`
      )
    );
  }

  // 2. Determine existing package placement
  const existingCategory = detectExistingCategory(existingPkg);
  const existingPlacement =
    existingCategory === "runnable" ? "apps" : "packages";
  const existingName = deriveProjectName(existingPkg.name ?? basename(rootDir));

  // 3. Check for name collision with scaffold target
  const newPlacement = target.placement;
  if (existingPlacement === newPlacement && existingName === scaffoldName) {
    return Result.err(
      new ScaffoldError(
        `Cannot scaffold '${scaffoldName}': existing package would be placed ` +
          `at the same location (${newPlacement}/${scaffoldName}/). ` +
          `Use a different name: outfitter scaffold ${target.id} <name>`
      )
    );
  }

  // 4. Collect files to move
  const entries = readdirSync(rootDir);
  const PRESERVE_AT_ROOT = new Set([
    ".git",
    "node_modules",
    ".outfitter",
    "bun.lock",
  ]);
  const toMove = entries.filter((e) => !PRESERVE_AT_ROOT.has(e));

  // 5. Stage files
  const stagingDir = join(
    dirname(rootDir),
    `.outfitter-staging-${process.pid}`
  );
  try {
    mkdirSync(stagingDir, { recursive: true });

    for (const entry of toMove) {
      renameSync(join(rootDir, entry), join(stagingDir, entry));
    }

    // 6. Create workspace directory structure
    const appsDir = join(rootDir, "apps");
    const packagesDir = join(rootDir, "packages");
    mkdirSync(appsDir, { recursive: true });
    mkdirSync(packagesDir, { recursive: true });

    // 7. Move staged files to final location
    const existingFinalDir = join(rootDir, existingPlacement, existingName);
    renameSync(stagingDir, existingFinalDir);

    // 8. Create workspace root package.json
    const workspaceRootPkg = buildWorkspaceRootPackageJson(
      existingPkg.name ? `${existingName}-workspace` : basename(rootDir)
    );
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify(workspaceRootPkg, null, 2) + "\n",
      "utf-8"
    );

    // 9. Create/update root .gitignore
    const gitignorePath = join(rootDir, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(
        gitignorePath,
        "node_modules\n**/dist\n.outfitter-staging-*\n",
        "utf-8"
      );
    }

    // 10. Clean up bun.lock
    //     bun.lock was deliberately preserved at root (not moved to staging)
    //     via PRESERVE_AT_ROOT. Delete it here; bun install will regenerate it.
    const lockPath = join(rootDir, "bun.lock");
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  } catch (error) {
    // Recovery: move staging back if it exists
    if (existsSync(stagingDir)) {
      try {
        recoverConversion(rootDir, stagingDir, toMove);
      } catch {
        // Recovery failed — tell user
      }
    }
    return Result.err(
      new ScaffoldError(
        `Workspace conversion failed: ${error instanceof Error ? error.message : "Unknown error"}. ` +
          `Check .outfitter-staging-${process.pid} for original files.`
      )
    );
  }

  return Result.ok({
    movedExisting: {
      from: rootDir,
      to: join(rootDir, existingPlacement, existingName),
      name: existingName,
    },
  });
}
```

### 9.4 `scaffoldIntoWorkspace()`

```typescript
interface IntoWorkspaceResult {
  readonly targetDir: string;
  readonly patternsUpdated: boolean;
  readonly blocksAdded?: AddBlockResult;
  readonly hookRan: boolean;
}

async function scaffoldIntoWorkspace(
  rootDir: string,
  target: TargetDefinition,
  name: string,
  options: ScaffoldOptions
): Promise<Result<IntoWorkspaceResult, ScaffoldError>> {
  // 1. Compute target directory
  const targetDir = join(rootDir, target.placement, name);

  // 2. Check for existing directory
  if (existsSync(targetDir) && !options.force) {
    return Result.err(
      new ScaffoldError(
        `'${target.placement}/${name}/' already exists. Use --force to overwrite.`
      )
    );
  }

  // 3. Ensure workspace patterns cover the placement directory
  const patternsUpdated = ensureWorkspacePattern(rootDir, target.placement);

  // 4. Resolve template
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, target.templateDir);
  if (!existsSync(templatePath)) {
    return Result.err(
      new ScaffoldError(
        `Template '${target.templateDir}' not found in ${templatesDir}`
      )
    );
  }

  // 5. Compute placeholder values
  const packageName = name.includes("/") ? name : name; // preserve scoped names
  const projectName = deriveProjectName(packageName);
  const values: PlaceholderValues = {
    name: projectName,
    projectName,
    packageName,
    binName: projectName.toLowerCase().replace(/\s+/g, "-"),
    version: "0.1.0",
    description: `${target.description} scaffolded with Outfitter`,
    author: resolveAuthor(), // from engine/names.ts -- same resolution as init
    year: String(new Date().getFullYear()),
  };

  // 6. Copy template files (workspace mode: skip root config files)
  //    Layer 1: _base template (if exists)
  //    The skipFilter uses shouldSkipFile() from Section 8.2 to skip
  //    root-level config files (.gitignore, biome.json, .lefthook.yml)
  //    when scaffolding into a workspace.
  const skipFilter = (path: string) => shouldSkipFile(path, "workspace-member");
  const basePath = join(templatesDir, "_base");
  const baseWrittenPaths = new Set<string>();
  if (existsSync(basePath)) {
    const baseResult = copyTemplateFiles(
      basePath,
      targetDir,
      values,
      options.force,
      { writtenPaths: baseWrittenPaths, skipFilter }
    );
    if (baseResult.isErr()) return baseResult;
  }

  //    Layer 2: Target-specific template (overlays base)
  const templateResult = copyTemplateFiles(
    templatePath,
    targetDir,
    values,
    options.force,
    { allowOverwrite: true, overwritablePaths: baseWrittenPaths, skipFilter }
  );
  if (templateResult.isErr()) return templateResult;

  // 7. Inject shared config
  const injectResult = injectSharedConfig(targetDir);
  if (injectResult.isErr()) return injectResult;

  // 8. Rewrite local dependencies if requested
  if (options.local) {
    const rewriteResult = rewriteLocalDependencies(targetDir);
    if (rewriteResult.isErr()) return rewriteResult;
  }

  // 9. Add tooling blocks
  let blocksAdded: AddBlockResult | undefined;
  if (!options.noTooling) {
    const blockNames = options.withBlocks
      ? options.withBlocks
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean)
      : [...target.defaultBlocks];

    if (blockNames.length > 0) {
      const blocksResult = await addBlocks(
        targetDir,
        blockNames,
        options.force
      );
      if (blocksResult.isErr()) return blocksResult;
      blocksAdded = blocksResult.value;
    }
  }

  // 10. Run post-scaffold hook
  let hookRan = false;
  const hookResult = await runPostScaffoldHook(templatePath, {
    rootDir,
    targetDir,
    name,
    target,
    converted: false, // caller knows this, not us
  });
  if (hookResult.isOk()) {
    hookRan = hookResult.value !== undefined;
  }

  return Result.ok({
    targetDir,
    patternsUpdated,
    blocksAdded,
    hookRan,
  });
}
```

---

## 10. Edge Cases

### 10.1 Scaffold Target That Already Exists

**Scenario**: `outfitter scaffold mcp` when `apps/mcp/` already exists.

**Behavior**:

- Without `--force`: error with message `'apps/mcp/' already exists. Use --force to overwrite.`
- With `--force`: overwrite files in the existing directory. Existing files not in the template
  are preserved (template copy is additive, not destructive).
- With a different name: `outfitter scaffold mcp my-mcp` creates `apps/my-mcp/` instead.

### 10.2 Scaffold Same Type as Current Project

**Scenario**: Single-package CLI project, user runs `outfitter scaffold cli`.

**Behavior**:

- Existing package detected as runnable, moved to `apps/<existing-name>/`
- New CLI scaffolded to `apps/cli/` (or `apps/<name>` if name provided)
- Both exist in the workspace. User may intend to have multiple CLIs.
- If names collide (existing CLI named "cli" and scaffold target defaults to "cli"):
  error with message suggesting a different name.

### 10.3 Scaffold lib When Project IS a lib

**Scenario**: Single-package library project, user runs `outfitter scaffold lib utils`.

**Behavior**:

- Existing package detected as library, moved to `packages/<existing-name>/`
- New lib scaffolded to `packages/utils/`
- Both coexist in `packages/`.

### 10.4 Workspace With Non-Standard Directory Structure

**Scenario**: Workspace uses `src/` instead of `apps/`/`packages/` for workspace members.

```json
{
  "workspaces": ["src/*"]
}
```

**Behavior**:

- The scaffold command does NOT try to match existing conventions.
- It adds `apps/*` or `packages/*` to the workspaces array as needed.
- The user's existing `src/*` packages are untouched.
- Output includes: `Added 'apps/*' to workspace patterns`
- This is the correct behavior. Outfitter follows Turborepo conventions. If users want their
  package elsewhere, they can move it after scaffolding.

### 10.5 Partially Failed Conversion Recovery

**Scenario**: Conversion fails after moving files to staging but before creating workspace root.

**Recovery steps**:

1. Check for `.outfitter-staging-<pid>` directory
2. If found, move contents back to rootDir
3. Remove any partially created workspace directories (apps/, packages/)
4. Remove any newly created workspace root package.json
5. Log recovery actions

**User fallback**: If automatic recovery fails, the staging directory preserves original files.
The user can manually restore by moving staging contents back. Git also provides recovery
via `git checkout .` if the project was committed.

### 10.6 Running Inside a Workspace Member

**Scenario**: User cwd is `apps/my-cli/` within a workspace, runs `outfitter scaffold mcp`.

**Behavior**:

- `detectProjectStructure` walks up from cwd, finds workspace root
- Scaffolds into the workspace root (not relative to cwd)
- New package placed at `<workspace-root>/apps/mcp/`

### 10.7 Scaffold With `--dry-run` During Conversion

**Scenario**: `outfitter scaffold mcp --dry-run` on a single-package project.

**Behavior**: The entire operation (conversion + scaffold) is simulated. Output shows:

```
Would convert to workspace:
  Move ./ -> apps/my-cli/
  Create workspace root package.json
  Add 'apps/*', 'packages/*' to workspace patterns

Would scaffold:
  Create apps/mcp/package.json
  Create apps/mcp/src/index.ts
  Create apps/mcp/tsconfig.json
  Add block: scaffolding
  Run: bun install
```

No filesystem changes are made.

---

## 11. Output Design

### 11.1 Human Output (Conversion + Scaffold)

```
Converted to workspace structure:
  Moved existing package -> apps/my-cli/
  Created workspace root package.json
  Added 'apps/*', 'packages/*' to workspace patterns

Scaffolded apps/mcp/:
  Created 5 files from 'mcp' template
  Added 2 tooling file(s):
    + biome.json
    + lefthook.yml

Next steps:
  cd apps/mcp
  bun run dev
```

### 11.2 Human Output (Scaffold into Existing Workspace)

```
Scaffolded apps/api/:
  Created 4 files from 'api' template
  Added 1 tooling file(s):
    + biome.json

Next steps:
  cd apps/api
  bun run dev
```

### 11.3 JSON Output

```json
{
  "target": "mcp",
  "targetDir": "/path/to/project/apps/mcp",
  "rootDir": "/path/to/project",
  "converted": true,
  "movedExisting": {
    "from": "/path/to/project",
    "to": "/path/to/project/apps/my-cli",
    "name": "my-cli"
  },
  "workspacePatternsUpdated": true,
  "blocksAdded": {
    "created": ["biome.json", "lefthook.yml"],
    "skipped": [],
    "overwritten": [],
    "dependencies": {},
    "devDependencies": {}
  },
  "postScaffoldHookRan": false,
  "nextSteps": ["cd apps/mcp", "bun run dev"]
}
```

---

## 12. Action Registry Integration

The scaffold command registers as an action following the same pattern as `create` and `init`:

```typescript
const scaffoldInputSchema = z.object({
  target: z.string(),
  name: z.string().optional(),
  force: z.boolean(),
  skipInstall: z.boolean(),
  dryRun: z.boolean(),
  withBlocks: z.string().optional(),
  noTooling: z.boolean().optional(),
  local: z.boolean().optional(),
  cwd: z.string(),
  outputMode: outputModeSchema,
});

const scaffoldAction = defineAction({
  id: "scaffold",
  description: "Add a capability to an existing project",
  surfaces: ["cli"],
  input: scaffoldInputSchema,
  cli: {
    command: "scaffold <target> [name]",
    description:
      "Add a capability (cli, mcp, daemon, lib, ...) to an existing project",
    options: [
      {
        flags: "-f, --force",
        description: "Overwrite existing files",
        defaultValue: false,
      },
      {
        flags: "--skip-install",
        description: "Skip bun install",
        defaultValue: false,
      },
      {
        flags: "--dry-run",
        description: "Preview changes without executing",
        defaultValue: false,
      },
      {
        flags: "--with <blocks>",
        description: "Comma-separated tooling blocks to add",
      },
      { flags: "--no-tooling", description: "Skip default tooling blocks" },
      {
        flags: "--local",
        description: "Use workspace:* for @outfitter dependencies",
      },
    ],
    mapInput: (context) => ({
      target: context.args[0] as string,
      name: context.args[1] as string | undefined,
      force: Boolean(context.flags["force"]),
      skipInstall: Boolean(
        context.flags["skip-install"] ?? context.flags["skipInstall"]
      ),
      dryRun: Boolean(context.flags["dry-run"] ?? context.flags["dryRun"]),
      withBlocks: resolveStringFlag(context.flags["with"]),
      noTooling: resolveNoToolingFlag(context.flags),
      local: resolveLocalFlag(context.flags),
      cwd: process.cwd(),
      outputMode: resolveOutputMode(context.flags),
    }),
  },
  handler: async (input) => {
    const { outputMode, ...scaffoldInput } = input;
    const result = await runScaffold(scaffoldInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "scaffold" },
        })
      );
    }

    await printScaffoldResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});
```

---

## 13. Dependencies Between Slices

```
Slice 0 (Target Registry)
    |
    v
Slice 1 (Shared Engine) -----> extracts: copyTemplateFiles, replacePlaceholders,
    |                           injectSharedConfig, rewriteLocalDependencies,
    |                           detectWorkspaceRoot, BINARY_EXTENSIONS, etc.
    |
    +---> Slice 2 (Init Consolidation) -- init uses shared engine
    |
    +---> Slice 3 (Scaffold Command) -- scaffold uses shared engine + registry
              |
              v
          Slice 4 (Workspace Conversion) -- convertToWorkspace, detectProjectStructure
              |
              v
          Slice 5 (Post-Scaffold Automation) -- bun install, git init, hooks
              |
              v
          Slice 6 (Dry Run) -- operation collection mode
```

Slices 3 and 4 can be built together since workspace conversion is integral to the scaffold
command. They are separated in the plan for review granularity, but the implementation is
tightly coupled.

---

## 14. Test Strategy

### 14.1 Unit Tests

| Function                 | Tests                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `detectProjectStructure` | none/single/workspace detection, nested workspace detection, inside workspace member |
| `detectExistingCategory` | bin field -> runnable, MCP deps -> runnable, default -> library                      |
| `resolveTarget`          | valid target, stub target, unknown target, non-scaffoldable target                   |
| `ensureWorkspacePattern` | pattern already present, pattern missing, non-standard patterns                      |
| `shouldSkipFile`         | standalone mode skips nothing, workspace-member mode skips root configs              |

### 14.2 Integration Tests

All integration tests use temp directories and clean up after themselves (matching existing
test patterns in `create.test.ts`).

| Scenario                             | Assertion                                                       |
| ------------------------------------ | --------------------------------------------------------------- |
| Scaffold MCP into existing workspace | `apps/mcp/` created, package.json valid, template files present |
| Scaffold lib into workspace          | `packages/<name>/` created, not `apps/`                         |
| Scaffold into single-package project | Converted to workspace, both packages present                   |
| Scaffold with name collision         | Error returned, no filesystem changes                           |
| Scaffold stub target                 | Error with "not yet available" message                          |
| Scaffold minimal                     | Error with "use init" message                                   |
| Post-scaffold hook execution         | Hook ran, context passed correctly                              |
| Workspace pattern auto-update        | Pattern added to root package.json                              |
| Force overwrite existing target      | Files overwritten, no error                                     |
| Category detection: CLI project      | Detected as runnable, placed in apps/                           |
| Category detection: plain lib        | Detected as library, placed in packages/                        |

### 14.3 Recovery Tests

| Scenario                                | Assertion                                            |
| --------------------------------------- | ---------------------------------------------------- |
| Conversion fails mid-operation          | Staging directory exists, original files recoverable |
| Staging directory cleaned up on success | No `.outfitter-staging-*` directories remain         |

---

## 15. Resolved Questions (Post-Review)

These were open during design and resolved before implementation:

1. **`--structure single` for scaffold?** **No.** Scaffold always produces a workspace. Adding
   a capability inherently means "add a second package," which requires a workspace. Users who
   want to add files to a single package without workspace overhead should use `outfitter add`
   (tooling blocks) or manual file creation. Keeping scaffold workspace-only simplifies the
   mental model: `init` = new project, `scaffold` = add to workspace.

2. **Cross-package dependency wiring?** **No.** The scaffold command does not automatically add
   the new package as a dependency of existing packages. The user decides inter-package
   dependencies. Automatic wiring would make assumptions about intent that are often wrong
   (e.g., scaffolding a second CLI doesn't mean it depends on the first). Users add deps
   explicitly via `bun add <package-name>`.

3. **Turbo configuration?** **No, out of scope.** Turbo.json is a build tool concern, not a
   scaffolding concern. If Outfitter later adds a `turbo` tooling block (`outfitter add turbo`),
   it can generate `turbo.json`. Workspace conversion produces a working Bun workspace without
   Turbo — `bun run --filter '*' build` works natively.

4. **biome.json inheritance?** **Yes, in workspace mode.** When scaffolding into a workspace,
   skip the root-level biome.json (handled by `WORKSPACE_SKIP`) and create
   `biome.json` with `{ "extends": ["../../biome.json"] }` in the package directory instead.
   This lets workspace members inherit shared config while allowing per-package overrides.
   Implementation detail for the template engine — does not affect the command design.
