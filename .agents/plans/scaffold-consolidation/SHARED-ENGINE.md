# Shared Scaffolding Engine -- Extraction Map

**Status**: Ready for implementation
**Slice**: `feature/scaffold/1-shared-engine`
**Last Updated**: 2026-02-12

## 1. Diff Map: create.ts vs init.ts

### 1.1 Identical or Near-Identical Functions

These functions exist in both files with the same logic and can be extracted verbatim. Minor
differences noted inline.

| Function | create.ts lines | init.ts lines | Differences |
|---|---|---|---|
| `BINARY_EXTENSIONS` | 98-135 | 97-141 | **Identical set**. init.ts has comments, create.ts does not. |
| `DEPENDENCY_SECTIONS` | 137-142 | 407-412 | **Identical**. |
| `isBinaryFile` | 194-196 | 149-152 | **Identical logic**. init.ts extracts to local variable first. |
| `getTemplatesDir` | 173-185 | 161-178 | **Identical logic**. Walk up from `import.meta.url` up to 10 levels. |
| `getOutputFilename` | 187-192 | 218-223 | **Identical**. |
| `replacePlaceholders` | 198-208 | 203-213 | **Identical**. |
| `deriveProjectName` | 163-171 | 240-248 | **Identical** (also duplicated in `planner.ts` lines 13-24 with slightly different style). |
| `resolveYear` | 144-146 | 302-304 | **Identical**. |
| `rewriteLocalDependencies` | 322-369 | 414-459 | **Identical logic**. Only error class differs (`CreateError` vs `InitError`). |
| `injectSharedConfig` | 289-320 | 466-499 | **Identical logic**. Only error class differs. |
| `addBlocks` (block merging loop) | 371-408 (create.ts) | 637-673 (init.ts inline) | **Same logic pattern**. create.ts extracts to a named function; init.ts inlines in `runInit`. Both iterate blocks, call `runAdd`, merge `AddBlockResult`. |

### 1.2 Functions Similar but with Structural Differences

| Function | Where | Notes |
|---|---|---|
| `copyTemplateFiles` | create.ts 210-287, init.ts 332-401 | **Core logic identical**. create.ts adds `overwritablePaths?: ReadonlySet<string>` and `writtenPaths?: Set<string>` parameters for overlay tracking. init.ts uses a simpler signature without path tracking. The create.ts version is a superset. |
| `PlaceholderValues` interface | create.ts 77-85, init.ts 66-75 | init.ts includes `author: string`; create.ts does not. Union is `{ name, projectName, packageName, binName, version, description, author, year }`. |

### 1.3 Functions Unique to create.ts

| Function | Lines | Purpose |
|---|---|---|
| `parseBlocks` | 148-161 | Parses `--with` flag into string array. (init.ts has similar logic inline in `resolveBlocks`.) |
| `resolveInput` (interactive) | 628-780 | Full interactive prompt flow via `@clack/prompts`: project name, preset selection, structure selection, tooling confirmation, workspace name. This is the heart of create's interactivity. |
| `executePlan` | 454-558 | Executes a `CreateProjectPlan` change list (copy-template, inject-shared-config, rewrite-local-dependencies, add-blocks). This is the **plan executor** pattern. |
| `findProjectTargetDir` | 410-424 | Extracts target directory from a plan's copy-template step. |
| `applyBlockOverrides` | 426-452 | Replaces plan's add-blocks step with user-provided block list from `--with` flag. |
| `buildWorkspaceRootPackageJson` | 560-583 | Generates workspace root `package.json` content. |
| `scaffoldWorkspaceRoot` | 585-626 | Creates workspace root directory structure (package.json, packages/, .gitignore). |
| `printCreateResults` | 853-914 | Output formatting for create results (JSON + human-readable). |
| `createCommand` | 916-969 | Commander registration (will be retired in Slice 7). |
| **Types**: `CreateOptions`, `CreateResult`, `CreateError`, `CreateStructure`, `ResolvedCreateInput` | 44-96 | |

### 1.4 Functions Unique to init.ts

| Function | Lines | Purpose |
|---|---|---|
| `validateTemplate` | 183-196 | Validates template existence and returns path. (create.ts does this inline in `executePlan`.) |
| `resolvePackageName` | 253-258 | Trivial: `options.name ?? basename(resolvedTargetDir)`. |
| `resolveBinName` | 263-265 | `options.bin ?? deriveProjectName(projectName)`. create.ts relies on planner's `deriveBinName`. |
| `resolveTemplateName` | 270-272 | `options.template ?? "basic"`. |
| `resolveAuthor` | 274-300 | Reads author from env vars and `git config`. **Not in create.ts at all**. |
| `resolveBlocks` | 310-327 | Resolves blocks from options: noTooling -> undefined, with -> parse, default -> `["scaffolding"]`. |
| `hasPackageJson` | 232-234 | Trivial existence check. |
| `printInitResults` | 681-737 | Output formatting for init results (includes dependency count detail not in create). |
| `initCommand` | 753-943 | Commander registration with subcommands (`init cli`, `init mcp`, `init daemon`), shared options helper `withCommonOptions`. |
| **Types**: `InitOptions`, `InitResult`, `InitError` | 36-87 | |

### 1.5 Shared Constants (from shared-deps.ts)

Both files import from `./shared-deps.js`:

| Constant | Location | Used By |
|---|---|---|
| `SHARED_DEV_DEPS` | shared-deps.ts:16-23 | Both `injectSharedConfig` functions |
| `SHARED_SCRIPTS` | shared-deps.ts:29-38 | Both `injectSharedConfig` functions |

These stay where they are -- the engine imports them.

### 1.6 The Planner (create/planner.ts)

The planner is already a separate module (`apps/outfitter/src/create/planner.ts`) that produces a
`CreateProjectPlan` from `CreateProjectInput`. It contains:

- `derivePackageName` -- third copy of name derivation (alongside init.ts and create.ts)
- `deriveProjectName` -- third copy of project name derivation
- `deriveBinName` -- lowercases and hyphenates
- `planCreateProject` -- validates inputs, resolves preset, builds change list

The planner is consumed only by create.ts today. The engine should either:
1. Absorb the planner's logic (if the plan/execute split doesn't survive), or
2. Keep the planner as the plan builder and have the engine be a generalized executor

Given that `init.ts` already has the same operations hardcoded in sequence (copy, inject, rewrite,
add-blocks), the plan/execute pattern is the right abstraction. The engine should be the executor;
both commands build plans.

---

## 2. Engine Module Design

### 2.1 Module Structure

```
apps/outfitter/src/engine/
  index.ts            -- barrel export
  types.ts            -- engine interfaces (ScaffoldPlan, PlaceholderValues, EngineOptions, etc.)
  template.ts         -- getTemplatesDir, copyTemplateFiles, getOutputFilename, isBinaryFile,
                         replacePlaceholders, BINARY_EXTENSIONS
  config.ts           -- injectSharedConfig, rewriteLocalDependencies, DEPENDENCY_SECTIONS
  blocks.ts           -- addBlocks (the merge loop)
  names.ts            -- deriveProjectName, deriveBinName, resolveAuthor, resolveYear
  workspace.ts        -- buildWorkspaceRootPackageJson, scaffoldWorkspaceRoot,
                         detectWorkspaceRoot (extracted from update-workspace.ts)
  executor.ts         -- executePlan (walks a ScaffoldPlan and applies changes)
  __tests__/
    template.test.ts  -- getTemplatesDir path resolution, copyTemplateFiles
    config.test.ts    -- injectSharedConfig, rewriteLocalDependencies
    executor.test.ts  -- executePlan end-to-end
    names.test.ts     -- deriveProjectName, resolveAuthor
```

### 2.2 TypeScript Interfaces

```typescript
// engine/types.ts

import type { AddBlockResult } from "@outfitter/tooling";

/**
 * Unified placeholder values for template substitution.
 * Superset of both init and create placeholder sets.
 *
 * `author` is resolved via `resolveAuthor()` (from init.ts, now in
 * engine/names.ts). Both `init` and `create` populate this field
 * starting in Slice 1. Templates without `{{author}}` are unaffected.
 */
export interface PlaceholderValues {
  readonly name: string;
  readonly projectName: string;
  readonly packageName: string;
  readonly binName: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly year: string;
}

/**
 * A single change operation in a scaffold plan.
 *
 * This is a generalization of CreatePlanChange from create/types.ts.
 * The engine executes these in order.
 */
export type ScaffoldChange =
  | {
      readonly type: "copy-template";
      /** Template directory name (e.g., "cli", "minimal") */
      readonly template: string;
      /** Absolute path to write files into */
      readonly targetDir: string;
      /** Whether to first copy _base/ then overlay this template */
      readonly overlayBaseTemplate: boolean;
    }
  | {
      readonly type: "inject-shared-config";
    }
  | {
      readonly type: "rewrite-local-dependencies";
      readonly mode: "workspace";
    }
  | {
      readonly type: "add-blocks";
      readonly blocks: readonly string[];
    };

/**
 * A complete scaffold plan -- the input to the engine executor.
 *
 * Both `init` and `scaffold` (formerly `create`) build one of these,
 * then hand it to `executePlan`.
 */
export interface ScaffoldPlan {
  /** Placeholder values for template substitution */
  readonly values: PlaceholderValues;
  /** Ordered list of changes to apply */
  readonly changes: readonly ScaffoldChange[];
}

/**
 * Result of executing a scaffold plan.
 */
export interface ScaffoldResult {
  /** The directory where project files were written */
  readonly projectDir: string;
  /** Blocks that were added, if any */
  readonly blocksAdded?: AddBlockResult | undefined;
}

/**
 * Unified error type for engine operations.
 */
export class ScaffoldError extends Error {
  readonly _tag = "ScaffoldError" as const;

  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}
```

### 2.3 Extraction Plan by Function

| Function | Source | Destination | Refactoring Required |
|---|---|---|---|
| `BINARY_EXTENSIONS` | both | `engine/template.ts` | None -- take create.ts version (no comments, same set). |
| `isBinaryFile` | both | `engine/template.ts` | None. |
| `getTemplatesDir` | both | `engine/template.ts` | None. |
| `getOutputFilename` | both | `engine/template.ts` | None. |
| `replacePlaceholders` | both | `engine/template.ts` | None. |
| `copyTemplateFiles` | both | `engine/template.ts` | Use create.ts version (superset with `overwritablePaths` and `writtenPaths`). Change error type from `CreateError`/`InitError` to `ScaffoldError`. |
| `DEPENDENCY_SECTIONS` | both | `engine/config.ts` | None. |
| `injectSharedConfig` | both | `engine/config.ts` | Change error type to `ScaffoldError`. |
| `rewriteLocalDependencies` | both | `engine/config.ts` | Change error type to `ScaffoldError`. |
| `addBlocks` (merge loop) | create.ts named fn, init.ts inline | `engine/blocks.ts` | Extract init.ts's inline version into the same named function as create.ts. Change error type to `ScaffoldError`. |
| `deriveProjectName` | all three files | `engine/names.ts` | Consolidate. Take planner.ts version (handles edge cases slightly differently with `indexOf`). |
| `deriveBinName` | planner.ts only | `engine/names.ts` | Move from planner.ts. |
| `resolveAuthor` | init.ts only | `engine/names.ts` | Move. Now available to both commands. |
| `resolveYear` | both | `engine/names.ts` | None. |
| `buildWorkspaceRootPackageJson` | create.ts only | `engine/workspace.ts` | **Update**: Change `workspaces: ["packages/*"]` to `workspaces: ["apps/*", "packages/*"]` and update scripts from `packages/<name>` patterns to `--filter '*'` patterns. This aligns with Decision 7 (runnable targets in `apps/`, libraries in `packages/`). The current version only supports `packages/` which would break workspace init with `--preset cli` since CLIs go in `apps/`. |
| `scaffoldWorkspaceRoot` | create.ts only | `engine/workspace.ts` | Change error type to `ScaffoldError`. Update to create both `apps/` and `packages/` directories. |
| `detectWorkspaceRoot` | update-workspace.ts | `engine/workspace.ts` | Move from `commands/update-workspace.ts`. Needed by both `scaffold` (Slice 3) and `update` commands. |
| `executePlan` | create.ts only | `engine/executor.ts` | Generalize to accept `ScaffoldPlan` instead of `CreateProjectPlan`. Extract target dir from plan changes. |

### 2.4 How Commands Consume the Engine

#### init.ts (after extraction)

```typescript
// init.ts becomes a thin wrapper:
//
// 1. Resolve options (template, name, bin, author, blocks, etc.)
// 2. Validate template via engine
// 3. Build a ScaffoldPlan manually (same sequence as today):
//    - copy-template (with overlayBaseTemplate)
//    - inject-shared-config
//    - rewrite-local-dependencies (if local)
//    - add-blocks (resolved blocks)
// 4. Call engine.executePlan(plan, { force })
// 5. Return InitResult from ScaffoldResult

import { executePlan, type ScaffoldPlan } from "../engine/index.js";
import { deriveProjectName, resolveAuthor, resolveYear } from "../engine/names.js";

export async function runInit(options: InitOptions): Promise<Result<InitResult, InitError>> {
  // ... resolve inputs (same as today) ...

  const plan: ScaffoldPlan = {
    values: { name, projectName, packageName, binName, version, description, author, year },
    changes: [
      { type: "copy-template", template: templateName, targetDir: resolvedTargetDir, overlayBaseTemplate: true },
      { type: "inject-shared-config" },
      ...(options.local ? [{ type: "rewrite-local-dependencies" as const, mode: "workspace" as const }] : []),
      ...(blocks ? [{ type: "add-blocks" as const, blocks }] : []),
    ],
  };

  const result = await executePlan(plan, { force });
  // ... map ScaffoldResult to InitResult ...
}
```

#### create.ts (after extraction)

```typescript
// create.ts becomes a thin wrapper:
//
// 1. Resolve input (interactive prompts or --yes defaults)
// 2. Call planCreateProject (existing planner, unchanged)
// 3. Map CreateProjectPlan to ScaffoldPlan
// 4. Handle workspace root scaffolding if structure === "workspace"
// 5. Call engine.executePlan(plan, { force })
// 6. Return CreateResult from ScaffoldResult

import { executePlan, type ScaffoldPlan } from "../engine/index.js";
import { scaffoldWorkspaceRoot } from "../engine/workspace.js";

export async function runCreate(options: CreateOptions): Promise<Result<CreateResult, CreateError>> {
  const input = await resolveInput(options); // unchanged interactive flow
  // ... workspace root handling via engine/workspace.ts ...

  const planResult = planCreateProject({ ... });
  const plan = mapCreatePlanToScaffoldPlan(planResult.value);

  const result = await executePlan(plan, { force: options.force });
  // ... map ScaffoldResult to CreateResult ...
}
```

---

## 3. Pseudocode

### 3.1 Core Engine: Template Walking and File Copying

```typescript
// engine/template.ts

const BINARY_EXTENSIONS = new Set([".png", ".jpg", /* ... full set ... */]);

function isBinaryFile(filename: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filename).toLowerCase());
}

function getOutputFilename(templateFilename: string): string {
  return templateFilename.endsWith(".template")
    ? templateFilename.slice(0, -".template".length)
    : templateFilename;
}

function replacePlaceholders(content: string, values: PlaceholderValues): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.hasOwn(values, key)
      ? values[key as keyof PlaceholderValues]
      : match;
  });
}

/**
 * Recursively copies template files to target directory.
 *
 * This is the create.ts superset version with overlay support.
 * - `options.allowOverwrite`: when true, permits writing over existing files
 * - `options.overwritablePaths`: set of paths already written (by base layer) that may be overwritten
 * - `options.writtenPaths`: accumulator of paths written during this call (passed to overlay layer)
 * - `options.skipFilter`: optional predicate to skip files (used by scaffold for workspace-member
 *    mode to skip root-level config files like .gitignore, biome.json, .lefthook.yml)
 */
function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  values: PlaceholderValues,
  force: boolean,
  options?: {
    allowOverwrite?: boolean;
    overwritablePaths?: ReadonlySet<string>;
    writtenPaths?: Set<string>;
    skipFilter?: (relativePath: string) => boolean;
  },
): Result<void, ScaffoldError> {
  // ... (identical to current create.ts implementation, error type changed) ...
  // When options.skipFilter is provided, check it before processing each file:
  //   if (options?.skipFilter?.(relativePath)) continue;
}

function getTemplatesDir(): string {
  // Walk up from import.meta.url to find templates/ directory
  // ... (identical to current) ...
}
```

### 3.2 Core Engine: Config Injection

```typescript
// engine/config.ts

import { SHARED_DEV_DEPS, SHARED_SCRIPTS } from "../commands/shared-deps.js";

const DEPENDENCY_SECTIONS = [
  "dependencies", "devDependencies", "peerDependencies", "optionalDependencies",
] as const;

function injectSharedConfig(targetDir: string): Result<void, ScaffoldError> {
  // Read package.json
  // Merge SHARED_DEV_DEPS under existing devDeps (template wins)
  // Merge SHARED_SCRIPTS under existing scripts (template wins)
  // Write back
}

function rewriteLocalDependencies(targetDir: string): Result<void, ScaffoldError> {
  // Read package.json
  // For each dependency section, rewrite @outfitter/* versions to "workspace:*"
  // Write back if changed
}
```

### 3.3 Core Engine: Block Integration

```typescript
// engine/blocks.ts
//
// NOTE: This is the one intentional dependency inversion in the engine.
// The engine imports `runAdd` from commands/add.js because blocks are a
// separate system with their own registry. Extracting runAdd to a shared
// location is not worth the complexity — the dependency is one-way and
// stable. Do NOT import other command-level functions from the engine.

import type { AddBlockResult } from "@outfitter/tooling";
import { runAdd } from "../commands/add.js";

async function addBlocks(
  targetDir: string,
  blocks: readonly string[],
  force: boolean,
): Promise<Result<AddBlockResult, ScaffoldError>> {
  const merged: AddBlockResult = {
    created: [], skipped: [], overwritten: [],
    dependencies: {}, devDependencies: {},
  };

  for (const blockName of blocks) {
    const result = await runAdd({ block: blockName, force, dryRun: false, cwd: targetDir });
    if (result.isErr()) {
      return Result.err(new ScaffoldError(`Failed to add block '${blockName}': ${result.error.message}`));
    }
    // Merge into accumulated result
    merged.created.push(...result.value.created);
    merged.skipped.push(...result.value.skipped);
    merged.overwritten.push(...result.value.overwritten);
    Object.assign(merged.dependencies, result.value.dependencies);
    Object.assign(merged.devDependencies, result.value.devDependencies);
  }

  return Result.ok(merged);
}
```

### 3.4 Engine Entry Point: executePlan

```typescript
// engine/executor.ts

import type { ScaffoldPlan, ScaffoldResult, ScaffoldError } from "./types.js";
import { copyTemplateFiles, getTemplatesDir } from "./template.js";
import { injectSharedConfig, rewriteLocalDependencies } from "./config.js";
import { addBlocks } from "./blocks.js";

/**
 * Options passed through all engine functions.
 *
 * Designed as an object from Slice 1 so that Slice 6 (dry-run) can add
 * `collector?: OperationCollector` without refactoring every function signature.
 * The `collector` field is added in Slice 6 -- until then, it is undefined.
 */
interface EngineOptions {
  readonly force: boolean;
  // Added in Slice 6 (dry-run):
  // readonly collector?: OperationCollector;
}

/**
 * Executes a scaffold plan by applying each change in order.
 *
 * This is the unified entry point consumed by both `init` and `create`/`scaffold`.
 * The caller builds the plan; this function executes it.
 */
async function executePlan(
  plan: ScaffoldPlan,
  options: EngineOptions,
): Promise<Result<ScaffoldResult, ScaffoldError>> {
  const { force } = options;
  const templatesDir = getTemplatesDir();
  let projectDir: string | undefined;
  let blocksAdded: AddBlockResult | undefined;

  for (const change of plan.changes) {
    switch (change.type) {
      case "copy-template": {
        projectDir = change.targetDir;
        const templatePath = join(templatesDir, change.template);

        if (!existsSync(templatePath)) {
          return Result.err(
            new ScaffoldError(`Template '${change.template}' not found in ${templatesDir}`)
          );
        }

        if (change.overlayBaseTemplate) {
          // Layer 1: copy _base/ if it exists
          const basePath = join(templatesDir, "_base");
          if (existsSync(basePath)) {
            const baseWrittenPaths = new Set<string>();
            const baseResult = copyTemplateFiles(
              basePath, projectDir, plan.values, force,
              false, undefined, baseWrittenPaths,
            );
            if (baseResult.isErr()) return baseResult;

            // Layer 2: overlay template-specific files
            const templateResult = copyTemplateFiles(
              templatePath, projectDir, plan.values, force,
              true, baseWrittenPaths,
            );
            if (templateResult.isErr()) return templateResult;
          } else {
            // No _base -- just copy template directly
            const result = copyTemplateFiles(
              templatePath, projectDir, plan.values, force,
            );
            if (result.isErr()) return result;
          }
        } else {
          // Direct copy without base overlay
          const result = copyTemplateFiles(
            templatePath, projectDir, plan.values, force,
          );
          if (result.isErr()) return result;
        }
        break;
      }

      case "inject-shared-config": {
        if (!projectDir) break;
        const result = injectSharedConfig(projectDir);
        if (result.isErr()) return result;
        break;
      }

      case "rewrite-local-dependencies": {
        if (!projectDir) break;
        const result = rewriteLocalDependencies(projectDir);
        if (result.isErr()) return result;
        break;
      }

      case "add-blocks": {
        if (!projectDir) break;
        const result = await addBlocks(projectDir, change.blocks, force);
        if (result.isErr()) return result;
        blocksAdded = result.value;
        break;
      }
    }
  }

  if (!projectDir) {
    return Result.err(new ScaffoldError("Plan contains no copy-template step"));
  }

  return Result.ok({ projectDir, blocksAdded });
}
```

### 3.5 Mode-Aware Template Application

The plan handles standalone vs workspace at the **plan-building** level, not the engine level.
This keeps the engine simple: it just executes what it's told.

```
Standalone (init today):
  Plan: [
    copy-template("cli", "/path/to/project", overlayBase=true),
    inject-shared-config,
    rewrite-local-deps (if local),
    add-blocks(["scaffolding"]),
  ]

Workspace (create today):
  1. Caller runs scaffoldWorkspaceRoot() to create root package.json, packages/ dir
  2. Plan: [
       copy-template("mcp", "/path/to/root/packages/my-mcp", overlayBase=true),
       inject-shared-config,
       rewrite-local-deps (if local),
       add-blocks(["scaffolding"]),
     ]

Scaffold into existing workspace (future):
  1. Caller detects workspace structure, computes target dir (apps/X or packages/X)
  2. Plan: [
       copy-template("api", "/path/to/workspace/apps/my-api", overlayBase=true),
       inject-shared-config,
       add-blocks(preset.defaultBlocks),
     ]
  3. Engine skips root-level files when target is inside a workspace
     (this is where skip-root logic would go -- but per PLAN.md, this is
     handled by templates only containing package-level files, not root config)
```

**Key insight from the PLAN.md**: "Engine skips root-level files (tsconfig, root package.json,
workspace config) when scaffolding into a workspace." This means the engine needs a
`skipRootFiles` option or the `copy-template` change needs a `skipPatterns` field. However, this
is a Slice 3/4 concern -- for Slice 1, the engine just needs to replicate current behavior exactly.

---

## 4. Functions That Extract Cleanly vs Need Refactoring

### Extract Cleanly (copy-paste with error type change)

These functions have zero behavioral differences and only need the error class swapped:

1. `BINARY_EXTENSIONS` -- constant, no changes needed
2. `isBinaryFile` -- pure function, no changes needed
3. `getTemplatesDir` -- pure function, no changes needed
4. `getOutputFilename` -- pure function, no changes needed
5. `replacePlaceholders` -- pure function, no changes needed
6. `resolveYear` -- pure function, no changes needed
7. `DEPENDENCY_SECTIONS` -- constant, no changes needed
8. `SHARED_DEV_DEPS`, `SHARED_SCRIPTS` -- already in shared-deps.ts, no move needed

### Extract with Minor Refactoring (error type change only)

1. `copyTemplateFiles` -- use create.ts superset version, change `CreateError` to `ScaffoldError`
2. `injectSharedConfig` -- change `CreateError`/`InitError` to `ScaffoldError`
3. `rewriteLocalDependencies` -- change error types to `ScaffoldError`
4. `scaffoldWorkspaceRoot` -- change `CreateError` to `ScaffoldError`

### Need Meaningful Refactoring

1. **`deriveProjectName`** -- three copies with slightly different edge-case handling.
   Planner uses `indexOf("/")`, others use `split("/")[1]`. Consolidate to one version that
   handles all edge cases:
   ```typescript
   function deriveProjectName(packageName: string): string {
     if (!packageName.startsWith("@")) return packageName;
     const idx = packageName.indexOf("/");
     if (idx < 0) return packageName;
     const name = packageName.slice(idx + 1).trim();
     return name.length > 0 ? name : packageName;
   }
   ```

2. **`addBlocks`** -- create.ts has a named function; init.ts has the same loop inline.
   Extract the named function. Trivial refactoring.

3. **`executePlan`** -- currently tied to `CreateProjectPlan` type. Needs to accept
   `ScaffoldPlan` instead. The mapping from `CreateProjectPlan` to `ScaffoldPlan` is nearly 1:1
   since `ScaffoldChange` is designed to match `CreatePlanChange`.

4. **`PlaceholderValues`** -- init.ts has `author` field, create.ts does not. The unified
   type adds `author`. Templates that don't use `{{author}}` are unaffected (replacePlaceholders
   leaves unknown placeholders as-is, but author IS a known key -- so if a template has `{{author}}`
   create.ts would currently leave it unreplaced. Adding author to the unified values fixes this.)

---

## 5. Risks and Mitigations

### 5.1 What Could Break During Extraction

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **`getTemplatesDir` path resolution changes** | Medium | High | The function walks up from `import.meta.url`. Moving it to `engine/template.ts` changes the starting directory. **Required fix**: Refactor `getTemplatesDir` to anchor on a marker file (`package.json` with `name: "outfitter"`) rather than counting directory levels from `import.meta.url`. This makes it resilient to module reorganization. **Required test**: Add a unit test in `engine/__tests__/template.test.ts` that asserts the resolved path matches the expected `templates/` directory. This test MUST pass before extraction is considered complete. |
| **`copyTemplateFiles` overlay behavior regression** | Low | High | create.ts has `overwritablePaths`/`writtenPaths` tracking; init.ts does not. Using the superset version for both is safe (init passes no tracking sets, so they default to `undefined`). | Existing tests cover both paths. Run both test suites after extraction. |
| **Error type consumers break** | Medium | Medium | Code that catches `InitError._tag === "InitError"` or `CreateError._tag === "CreateError"` will break if those types are replaced. | Keep `InitError` and `CreateError` as thin subclasses that wrap `ScaffoldError`, OR keep them as-is and map from `ScaffoldError` at the command boundary. The second approach is cleaner -- commands catch `ScaffoldError` and re-throw as their own error type. |
| **`resolveAuthor` not available in create.ts** | Low | Low | create.ts currently does not set `author` in PlaceholderValues. After extraction, if the unified values require `author`, create needs to call `resolveAuthor()`. If templates contain `{{author}}` it was previously unreplaced in create mode. | Adding author resolution to create is a behavior improvement, not a regression. Mark as intentional in the changeset. |
| **Planner contract changes** | Medium | Medium | If `ScaffoldPlan` replaces `CreateProjectPlan`, the planner's return type changes. Code that imports `CreateProjectPlan` would break. | Keep `CreateProjectPlan` as-is in Slice 1. Add a `toScaffoldPlan()` adapter function. Migrate the planner type in a later slice. |
| **Import path changes** | Low | Low | Moving functions from `commands/create.ts` and `commands/init.ts` to `engine/` changes import paths for tests and any internal consumers. | Update imports. No external consumers -- these are app-internal modules. |

### 5.2 Test Coverage Gaps

| Gap | Current State | Action Needed |
|---|---|---|
| **Engine module has no direct tests** | Engine doesn't exist yet. create.test.ts and init.test.ts test through the commands. | Write dedicated engine tests (unit-level) for `executePlan`, `copyTemplateFiles`, `injectSharedConfig`, `rewriteLocalDependencies`, `addBlocks`. These become the source of truth. |
| **`getTemplatesDir` path resolution** | Not directly tested -- only tested implicitly through full init/create runs. | Add a focused test that verifies the resolved path from the engine module location. |
| **`_base` overlay path** | Tested in create.test.ts (implicitly, since templates use `overlayBaseTemplate: true`) but `_base` directory doesn't exist yet. Both files guard with `existsSync`. | No immediate risk but should test the overlay path once `_base` exists. |
| **Binary file copy** | Not tested in isolation. Templates don't currently include binary files. | Add a test that copies a binary file (e.g., a `.png` fixture) and verifies it's not corrupted by placeholder replacement. |
| **`resolveAuthor` fallback chain** | Not tested. `init.test.ts` doesn't assert author values. | Add focused tests for the env var cascade and git config fallback. |
| **Workspace root scaffolding** | Tested in create.test.ts (`scaffolds a workspace layout...`). | Ensure this test still passes after workspace functions move to engine. |

### 5.3 Edge Cases in Current Implementations

1. **`deriveProjectName` with bare `@scope` (no slash)**: init.ts and create.ts return the
   full string `@scope`; planner.ts returns `""` (which then fails validation). The engine should
   return the full string as a fallback, letting the caller validate.

2. **Empty `--with` flag**: `parseBlocks("")` returns `undefined`; `resolveBlocks` with
   `with: ""` returns `undefined`. Both handle it. Engine should not special-case this -- callers
   normalize before building the plan.

3. **Multiple `copy-template` steps in a plan**: create.ts plans only ever have one
   `copy-template` step. The executor should handle multiple (future scaffold flows may compose
   templates). Current `projectDir` tracking takes the last one -- should take the first or
   require explicit specification.

4. **`injectSharedConfig` called on a dir with no `package.json`**: Both implementations
   short-circuit with `Result.ok(undefined)`. This is correct -- the engine preserves this.

5. **Race condition in `scaffoldWorkspaceRoot`**: Creates `packages/` dir and writes
   `package.json` and `.gitignore`. If interrupted between operations, leaves partial state.
   Acceptable for CLI tooling -- no transactional guarantee needed.

6. **Template files with `.template` extension AND binary extension**: e.g., `icon.png.template`
   would be renamed to `icon.png` and treated as binary (no placeholder replacement). This is
   correct behavior.

---

## 6. Migration Strategy

### Phase 1: Extract (this slice)

1. Create `apps/outfitter/src/engine/` module with types, template, config, blocks, names,
   workspace, and executor files
2. Move shared functions out of `create.ts` and `init.ts` into engine
3. Both `runInit` and `runCreate` import from engine
4. **Zero behavior change** -- all existing tests must pass unmodified
5. Both `InitError` and `CreateError` remain as command-level types that wrap engine errors

### Phase 2: Verify (still this slice)

1. Run `bun run test --filter=outfitter` and confirm all 17 test files pass
2. Run `bun run typecheck` to catch import/type issues
3. Run `bun run lint` to catch unused imports in the old locations

### Phase 3: Engine-Level Tests (this slice)

Co-located under `apps/outfitter/src/engine/__tests__/`:

1. `template.test.ts`:
   - `getTemplatesDir` resolves to the correct `templates/` directory from `engine/template.ts`
   - `copyTemplateFiles` with and without overlay
   - `copyTemplateFiles` with `skipFilter` (skips matching files)
   - Binary file copy preserves content without placeholder replacement
2. `config.test.ts`:
   - `injectSharedConfig` merge behavior
   - `rewriteLocalDependencies` selective rewriting
3. `executor.test.ts`:
   - `executePlan` end-to-end with a minimal plan
   - `addBlocks` merge accumulation
4. `names.test.ts`:
   - `deriveProjectName` edge cases (scoped, bare scope, no scope)
   - `resolveAuthor` fallback chain

### Phase 4: Planner Migration (this slice)

Update `create/planner.ts` to consume the target registry (`TargetDefinition`) instead of
`CreatePresetDefinition`. This eliminates the need for a `mapPresetToLegacy` bridge in Slice 2.

1. Change `planCreateProject` input from `preset: CreatePresetId` to `target: TargetDefinition`
2. Remove `getCreatePreset()` call — target is already resolved by the caller
3. Update `CreateProjectPlan` to include a `toScaffoldPlan()` adapter method (or add a
   standalone adapter function) for the transition period
4. Keep `CreatePresetId` and `CreatePresetDefinition` types alive until Slice 7 (create retirement)
5. Both `create.ts` and `init.ts` resolve their target via the registry, then pass it to the planner

---

## 7. File-Level Change Summary

| File | Action |
|---|---|
| `apps/outfitter/src/engine/index.ts` | **New** -- barrel exports |
| `apps/outfitter/src/engine/types.ts` | **New** -- `ScaffoldPlan`, `ScaffoldChange`, `ScaffoldResult`, `ScaffoldError`, `PlaceholderValues`, `EngineOptions` |
| `apps/outfitter/src/engine/template.ts` | **New** -- `BINARY_EXTENSIONS`, `isBinaryFile`, `getTemplatesDir`, `getOutputFilename`, `replacePlaceholders`, `copyTemplateFiles` |
| `apps/outfitter/src/engine/config.ts` | **New** -- `DEPENDENCY_SECTIONS`, `injectSharedConfig`, `rewriteLocalDependencies` |
| `apps/outfitter/src/engine/blocks.ts` | **New** -- `addBlocks` |
| `apps/outfitter/src/engine/names.ts` | **New** -- `deriveProjectName`, `deriveBinName`, `resolveAuthor`, `resolveYear` |
| `apps/outfitter/src/engine/workspace.ts` | **New** -- `buildWorkspaceRootPackageJson`, `scaffoldWorkspaceRoot`, `detectWorkspaceRoot` |
| `apps/outfitter/src/engine/executor.ts` | **New** -- `executePlan` |
| `apps/outfitter/src/commands/init.ts` | **Modified** -- remove extracted functions, import from engine |
| `apps/outfitter/src/commands/create.ts` | **Modified** -- remove extracted functions, import from engine |
| `apps/outfitter/src/create/planner.ts` | **Modified** -- import `deriveProjectName`, `deriveBinName` from engine instead of local definitions |
| `apps/outfitter/src/engine/__tests__/template.test.ts` | **New** -- template + getTemplatesDir tests |
| `apps/outfitter/src/engine/__tests__/config.test.ts` | **New** -- config injection tests |
| `apps/outfitter/src/engine/__tests__/executor.test.ts` | **New** -- executePlan + addBlocks tests |
| `apps/outfitter/src/engine/__tests__/names.test.ts` | **New** -- name derivation + resolveAuthor tests |
| `apps/outfitter/src/__tests__/init.test.ts` | **Unchanged** -- validates no regressions |
| `apps/outfitter/src/__tests__/create.test.ts` | **Unchanged** -- validates no regressions |

Total: 12 new files, 3 modified files, 0 deleted files.
