# Target Registry Design

**Slice**: 0 (`feature/scaffold/0-target-registry`)
**Module**: `apps/outfitter/src/targets/`
**Status**: Design complete, ready for implementation

## Overview

The target registry is a single source of truth that defines every scaffold target. Both `init`
and `scaffold` (future) consume it. It replaces the current `create/presets.ts` module and the
hardcoded template names in `init.ts`.

## File Layout

```
apps/outfitter/src/targets/
  index.ts          # Public barrel (re-exports types + registry API)
  registry.ts       # Target definitions and lookup functions
  types.ts          # TypeScript types/interfaces
  __tests__/
    registry.test.ts
```

## Types

```typescript
// apps/outfitter/src/targets/types.ts

/**
 * Unique identifier for a scaffold target.
 *
 * Constraint: lowercase alphanumeric, used in CLI arguments and template
 * directory names.
 */
export type TargetId =
  | "minimal"
  | "cli"
  | "mcp"
  | "daemon"
  | "api"
  | "worker"
  | "web"
  | "lib";

/**
 * Whether the target produces a runnable application or a library package.
 *
 * Determines workspace placement:
 * - `"runnable"` -> `apps/<name>/`
 * - `"library"` -> `packages/<name>/`
 */
export type TargetCategory = "runnable" | "library";

/**
 * Whether the target has a working template or is a planned placeholder.
 *
 * - `"ready"` -> Template exists, fully functional
 * - `"stub"` -> Registered for discoverability, errors on use
 */
export type TargetStatus = "ready" | "stub";

/**
 * Whether a target can be used with `init`, `scaffold`, or both.
 *
 * - `"init-only"` -> Only for new project creation (e.g., `minimal`)
 * - `"scaffold-only"` -> Only for adding to existing projects (none currently)
 * - `"both"` -> Works in both contexts
 */
export type TargetScope = "init-only" | "scaffold-only" | "both";

/**
 * Complete definition for a scaffold target.
 *
 * Immutable after registration. The registry is a static constant, not a
 * mutable store.
 */
export interface TargetDefinition {
  /** Unique target identifier, used as CLI argument */
  readonly id: TargetId;

  /** Human-readable one-line summary for help text and prompts */
  readonly description: string;

  /** Whether the target is runnable (apps/) or a library (packages/) */
  readonly category: TargetCategory;

  /**
   * Where the target is placed in a workspace.
   *
   * For init (single-package), this is informational only — the project
   * goes in the target directory regardless. For scaffold and workspace init,
   * this determines the parent directory.
   */
  readonly placement: "apps" | "packages";

  /**
   * Template directory name under `templates/`.
   *
   * For ready targets, this directory must exist.
   * For stubs, this is the planned directory name (may not exist yet).
   */
  readonly templateDir: string;

  /**
   * Default tooling blocks to add after scaffolding.
   *
   * Empty array means no blocks. The user can override with `--with` or
   * `--no-tooling`.
   */
  readonly defaultBlocks: readonly string[];

  /** Whether the template is available or still planned */
  readonly status: TargetStatus;

  /** Where this target can be used */
  readonly scope: TargetScope;
}
```

Registry functions use `NotFoundError` and `ValidationError` from `@outfitter/contracts`
rather than a custom error type. This keeps error handling consistent with the rest of the
codebase.

## Registry

```typescript
// apps/outfitter/src/targets/registry.ts

import { Result, NotFoundError, ValidationError } from "@outfitter/contracts";
import type {
  TargetCategory,
  TargetDefinition,
  TargetId,
  TargetScope,
  TargetStatus,
} from "./types.js";

/**
 * Canonical target registry.
 *
 * Every scaffold target is defined here. Both `init` and `scaffold` resolve
 * targets from this map. Order matters — it determines prompt display order.
 */
export const TARGET_REGISTRY: ReadonlyMap<TargetId, TargetDefinition> =
  new Map<TargetId, TargetDefinition>([
    [
      "minimal",
      {
        id: "minimal",
        description: "Minimal Bun + TypeScript project",
        category: "library",
        placement: "packages",
        templateDir: "minimal",
        defaultBlocks: ["scaffolding"],
        status: "ready",
        scope: "init-only",
      },
    ],
    [
      "cli",
      {
        id: "cli",
        description: "CLI application with Outfitter command ergonomics",
        category: "runnable",
        placement: "apps",
        templateDir: "cli",
        defaultBlocks: ["scaffolding"],
        status: "ready",
        scope: "both",
      },
    ],
    [
      "mcp",
      {
        id: "mcp",
        description: "MCP server with typed tools and action registry",
        category: "runnable",
        placement: "apps",
        templateDir: "mcp",
        defaultBlocks: ["scaffolding"],
        status: "ready",
        scope: "both",
      },
    ],
    [
      "daemon",
      {
        id: "daemon",
        description: "Background daemon with control CLI",
        category: "runnable",
        placement: "apps",
        templateDir: "daemon",
        defaultBlocks: ["scaffolding"],
        status: "ready",
        scope: "both",
      },
    ],
    [
      "api",
      {
        id: "api",
        description: "HTTP API server (Hono)",
        category: "runnable",
        placement: "apps",
        templateDir: "api",
        defaultBlocks: ["scaffolding"],
        status: "stub",
        scope: "both",
      },
    ],
    [
      "worker",
      {
        id: "worker",
        description: "Background job worker",
        category: "runnable",
        placement: "apps",
        templateDir: "worker",
        defaultBlocks: ["scaffolding"],
        status: "stub",
        scope: "both",
      },
    ],
    [
      "web",
      {
        id: "web",
        description: "Web application (TanStack Start)",
        category: "runnable",
        placement: "apps",
        templateDir: "web",
        defaultBlocks: ["scaffolding"],
        status: "stub",
        scope: "both",
      },
    ],
    [
      "lib",
      {
        id: "lib",
        description: "Shared library package",
        category: "library",
        placement: "packages",
        templateDir: "lib",
        defaultBlocks: ["scaffolding"],
        status: "stub",
        scope: "both",
      },
    ],
  ]);

// ---------------------------------------------------------------------------
// Derived constants (computed once from the registry)
// ---------------------------------------------------------------------------

/** All target IDs in registry order. */
export const TARGET_IDS: readonly TargetId[] = [
  ...TARGET_REGISTRY.keys(),
];

/** Only targets whose templates are ready. */
export const READY_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => TARGET_REGISTRY.get(id)!.status === "ready",
);

/** Targets available in `init` (ready + init-scoped). */
export const INIT_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => {
    const t = TARGET_REGISTRY.get(id)!;
    return t.status === "ready" && t.scope !== "scaffold-only";
  },
);

/** Targets available in `scaffold` (ready + scaffold-scoped). */
export const SCAFFOLD_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => {
    const t = TARGET_REGISTRY.get(id)!;
    return t.status === "ready" && t.scope !== "init-only";
  },
);

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

/**
 * Get a target definition by ID.
 *
 * Returns `NotFoundError` if the ID is not in the registry.
 */
export function getTarget(
  id: string,
): Result<TargetDefinition, NotFoundError> {
  const target = TARGET_REGISTRY.get(id as TargetId);
  if (!target) {
    return Result.err(
      new NotFoundError({
        message: `Unknown target '${id}'. Available targets: ${TARGET_IDS.join(", ")}`,
        resourceType: "target",
        resourceId: id,
      }),
    );
  }
  return Result.ok(target);
}

/**
 * Get a target that is ready for use (not a stub).
 *
 * Returns a validation error with a clear "not yet available" message
 * if the target exists but is a stub.
 */
export function getReadyTarget(
  id: string,
): Result<TargetDefinition, NotFoundError | ValidationError> {
  const targetResult = getTarget(id);
  if (targetResult.isErr()) {
    return targetResult;
  }

  const target = targetResult.value;
  if (target.status === "stub") {
    return Result.err(
      new ValidationError({
        message:
          `Target '${id}' is not yet available. ` +
          `It is planned but the template has not been implemented. ` +
          `Ready targets: ${READY_TARGET_IDS.join(", ")}`,
        field: "target",
      }),
    );
  }

  return Result.ok(target);
}

/**
 * Get a target valid for init (ready + in-scope for init).
 *
 * Validates both readiness and scope.
 */
export function getInitTarget(
  id: string,
): Result<TargetDefinition, NotFoundError | ValidationError> {
  const readyResult = getReadyTarget(id);
  if (readyResult.isErr()) {
    return readyResult;
  }

  const target = readyResult.value;
  if (target.scope === "scaffold-only") {
    return Result.err(
      new ValidationError({
        message:
          `Target '${id}' cannot be used with init. ` +
          `Use 'outfitter scaffold ${id}' instead.`,
        field: "target",
      }),
    );
  }

  return Result.ok(target);
}

/**
 * Get a target valid for scaffold (ready + in-scope for scaffold).
 *
 * Validates both readiness and scope.
 */
export function getScaffoldTarget(
  id: string,
): Result<TargetDefinition, NotFoundError | ValidationError> {
  const readyResult = getReadyTarget(id);
  if (readyResult.isErr()) {
    return readyResult;
  }

  const target = readyResult.value;
  if (target.scope === "init-only") {
    return Result.err(
      new ValidationError({
        message:
          `Target '${id}' cannot be scaffolded into an existing project. ` +
          `It is only available for new project creation via 'outfitter init'.`,
        field: "target",
      }),
    );
  }

  return Result.ok(target);
}

/**
 * Resolve the workspace placement directory for a target.
 *
 * Returns `"apps"` for runnable targets and `"packages"` for libraries.
 * This is used by both workspace init and scaffold to determine where
 * to create the package directory.
 */
export function resolvePlacement(
  target: TargetDefinition,
): "apps" | "packages" {
  return target.placement;
}

/**
 * List all targets, optionally filtered by status and/or scope.
 */
export function listTargets(filter?: {
  readonly status?: TargetStatus;
  readonly scope?: TargetScope;
  readonly category?: TargetCategory;
}): readonly TargetDefinition[] {
  let targets = [...TARGET_REGISTRY.values()];

  if (filter?.status) {
    targets = targets.filter((t) => t.status === filter.status);
  }
  if (filter?.scope) {
    targets = targets.filter((t) => t.scope === filter.scope);
  }
  if (filter?.category) {
    targets = targets.filter((t) => t.category === filter.category);
  }

  return targets;
}
```

## Barrel Export

```typescript
// apps/outfitter/src/targets/index.ts

export type {
  TargetCategory,
  TargetDefinition,
  TargetId,
  TargetScope,
  TargetStatus,
} from "./types.js";

export {
  getInitTarget,
  getReadyTarget,
  getScaffoldTarget,
  getTarget,
  INIT_TARGET_IDS,
  listTargets,
  READY_TARGET_IDS,
  resolvePlacement,
  SCAFFOLD_TARGET_IDS,
  TARGET_IDS,
  TARGET_REGISTRY,
} from "./registry.js";
```

## Target Catalog (Full Reference)

| ID | Category | Placement | Template Dir | Scope | Status | Template Files |
|---|---|---|---|---|---|---|
| `minimal` | library | `packages/` | `minimal` | init-only | ready | Renamed from `basic`. Same files: `src/index.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `.lefthook.yml` |
| `cli` | runnable | `apps/` | `cli` | both | ready | `src/cli.ts`, `src/program.ts`, `src/index.ts`, `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `.lefthook.yml`, `README.md` |
| `mcp` | runnable | `apps/` | `mcp` | both | ready | `src/server.ts`, `src/mcp.ts`, `src/index.ts`, `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `.lefthook.yml`, `README.md` |
| `daemon` | runnable | `apps/` | `daemon` | both | ready | `src/daemon.ts`, `src/daemon-main.ts`, `src/cli.ts`, `src/index.ts`, `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `.lefthook.yml`, `README.md` |
| `api` | runnable | `apps/` | `api` | both | stub | -- |
| `worker` | runnable | `apps/` | `worker` | both | stub | -- |
| `web` | runnable | `apps/` | `web` | both | stub | -- |
| `lib` | library | `packages/` | `lib` | both | stub | -- |

### Design Notes on `minimal`

- `minimal` is `init-only` because it is the blank-canvas starting point for new projects. Scaffolding a "minimal" package into a workspace is effectively `lib` -- so we guide users there instead of creating ambiguity.
- The `basic` template directory is renamed to `minimal` in this slice. Both the filesystem directory and the registry reference this new name.
- `minimal` has `category: "library"` and `placement: "packages"` because when used in workspace init mode it produces a library-shaped package (no `bin`, main entrypoint only). For single-package init, placement is informational only.

### Design Notes on `lib`

- `lib` is the scaffold-era replacement for "add a plain library to a workspace." It is a stub now because the `minimal` template was not designed for workspace injection — it assumes root-level scaffolding.
- When `lib` becomes ready, its template will be workspace-aware (no root-level config files like `.gitignore` or `.lefthook.yml` that belong at workspace root).

## How Consumers Use the Registry

### `init` (Slice 2 -- Init Consolidation)

Today `init` resolves templates via a raw string (`options.template ?? "basic"`). After this
slice, init uses the registry:

```typescript
// Before (current init.ts)
const templateName = options.template ?? "basic";
const templateResult = validateTemplate(templateName);

// After (init consumes registry)
import { getInitTarget } from "../targets/index.js";

const targetId = options.preset ?? options.template ?? "minimal";
const targetResult = getInitTarget(targetId);
if (targetResult.isErr()) {
  return Result.err(new InitError(targetResult.error.message));
}
const target = targetResult.value;
const templateName = target.templateDir;
```

The `--template` flag is deprecated in favor of `--preset`. During the transition, `--template`
still works but maps through the registry with a deprecation warning.

### `create` (Current, Slice 1 -- Shared Engine)

Today `create` uses `CREATE_PRESETS` from `create/presets.ts`. The planner calls
`getCreatePreset(input.preset)`. After registry adoption:

```typescript
// Before (current planner.ts)
const preset = getCreatePreset(input.preset);

// After (planner consumes registry)
import { getInitTarget } from "../targets/index.js";

const targetResult = getInitTarget(input.preset);
if (targetResult.isErr()) {
  return Result.err(new ValidationError({
    message: targetResult.error.message,
    field: "preset",
  }));
}
const target = targetResult.value;
```

The `CreatePresetDefinition` type is replaced by `TargetDefinition`. The planner's
`CreateProjectPlan` type updates its `preset` field to reference `TargetDefinition`.

### `scaffold` (Slice 3)

```typescript
import { getScaffoldTarget, resolvePlacement } from "../targets/index.js";

const targetResult = getScaffoldTarget(targetId);
if (targetResult.isErr()) {
  // Error already has clear messaging for stubs and scope violations
  return Result.err(targetResult.error);
}

const target = targetResult.value;
const parentDir = resolvePlacement(target); // "apps" | "packages"
const packageDir = join(workspaceRoot, parentDir, packageName);
```

### Interactive Prompts (Slice 2)

The current `create` command uses `CREATE_PRESET_IDS` to build the preset select prompt.
The registry provides equivalent filtered lists:

```typescript
import { INIT_TARGET_IDS, TARGET_REGISTRY } from "../targets/index.js";

const options = INIT_TARGET_IDS.map((id) => {
  const target = TARGET_REGISTRY.get(id)!;
  return {
    value: id,
    label: id,
    hint: target.description,
  };
});
```

## Pseudocode: Key Operations

### Registry Lookup and Validation

```
function getTarget(id):
  target = REGISTRY.get(id)
  if not target:
    return Err(NotFoundError "Unknown target '<id>'")
  return Ok(target)

function getReadyTarget(id):
  target = getTarget(id)?
  if target.status == "stub":
    return Err(ValidationError "Target '<id>' is not yet available")
  return Ok(target)

function getInitTarget(id):
  target = getReadyTarget(id)?
  if target.scope == "scaffold-only":
    return Err(ValidationError "Cannot use '<id>' with init")
  return Ok(target)

function getScaffoldTarget(id):
  target = getReadyTarget(id)?
  if target.scope == "init-only":
    return Err(ValidationError "Cannot scaffold '<id>' into existing project")
  return Ok(target)
```

### Target-to-Template Resolution

```
function resolveTemplate(target):
  templatesDir = getTemplatesDir()
  templatePath = join(templatesDir, target.templateDir)

  if not exists(templatePath):
    return Err("Template directory not found for target '<id>'")

  return Ok(templatePath)
```

This is handled by the existing `validateTemplate()` in `init.ts`. The change is that the
template name comes from `target.templateDir` instead of raw user input.

### Stub Target Error Handling

```
function getReadyTarget(id):
  target = getTarget(id)?

  if target.status == "stub":
    return Err(ValidationError(
      message: "Target '<id>' is not yet available. "
             + "It is planned but the template has not been implemented. "
             + "Ready targets: minimal, cli, mcp, daemon",
      field: "target"
    ))

  return Ok(target)
```

Stub errors are caught early -- before any filesystem operations. The error includes:
1. What the user asked for
2. Why it failed (template not implemented)
3. What they can use instead (ready targets list)

### Category-Based Placement Resolution

```
function resolvePackageDir(target, workspaceRoot, packageName):
  parentDir = target.placement     // "apps" | "packages"
  return join(workspaceRoot, parentDir, packageName)
```

For init single-package mode, placement is ignored -- the project goes in the target directory.
For init workspace mode and scaffold, placement determines the subdirectory.

## Test Plan

```typescript
// apps/outfitter/src/targets/__tests__/registry.test.ts

describe("target registry", () => {
  // --- Registry integrity ---

  test("contains exactly 8 targets", () => {
    expect(TARGET_REGISTRY.size).toBe(8);
  });

  test("all target IDs are unique", () => {
    const ids = [...TARGET_REGISTRY.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every ready target has a templateDir that matches an existing directory", () => {
    // Verifies templates/ actually contains the referenced dirs
  });

  // --- Lookup ---

  test("getTarget returns Ok for known target", () => {
    const result = getTarget("cli");
    expect(result.isOk()).toBe(true);
    expect(result.value.id).toBe("cli");
  });

  test("getTarget returns NotFoundError for unknown ID", () => {
    const result = getTarget("unknown");
    expect(result.isErr()).toBe(true);
  });

  // --- Ready validation ---

  test("getReadyTarget returns Ok for ready target", () => {
    const result = getReadyTarget("mcp");
    expect(result.isOk()).toBe(true);
  });

  test("getReadyTarget returns ValidationError for stub target", () => {
    const result = getReadyTarget("api");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("not yet available");
      expect(result.error.message).toContain("Ready targets:");
    }
  });

  // --- Scope validation ---

  test("getInitTarget allows minimal", () => {
    const result = getInitTarget("minimal");
    expect(result.isOk()).toBe(true);
  });

  test("getScaffoldTarget rejects minimal (init-only)", () => {
    const result = getScaffoldTarget("minimal");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("init");
    }
  });

  test("getScaffoldTarget allows cli", () => {
    const result = getScaffoldTarget("cli");
    expect(result.isOk()).toBe(true);
  });

  // --- Placement ---

  test("runnable targets resolve to apps/", () => {
    const target = TARGET_REGISTRY.get("cli")!;
    expect(resolvePlacement(target)).toBe("apps");
  });

  test("library targets resolve to packages/", () => {
    const target = TARGET_REGISTRY.get("lib")!;
    expect(resolvePlacement(target)).toBe("packages");
  });

  // --- Derived lists ---

  test("INIT_TARGET_IDS excludes stubs", () => {
    for (const id of INIT_TARGET_IDS) {
      expect(TARGET_REGISTRY.get(id)!.status).toBe("ready");
    }
  });

  test("SCAFFOLD_TARGET_IDS excludes init-only targets", () => {
    for (const id of SCAFFOLD_TARGET_IDS) {
      expect(TARGET_REGISTRY.get(id)!.scope).not.toBe("init-only");
    }
  });

  // --- listTargets ---

  test("listTargets with status filter returns only matching targets", () => {
    const stubs = listTargets({ status: "stub" });
    expect(stubs.every((t) => t.status === "stub")).toBe(true);
    expect(stubs.length).toBe(4);
  });

  test("listTargets with category filter returns correct placement", () => {
    const libs = listTargets({ category: "library" });
    expect(libs.every((t) => t.placement === "packages")).toBe(true);
  });
});
```

## Migration Path

### What Changes

#### 1. Rename `templates/basic/` to `templates/minimal/`

Filesystem rename. The `basic` directory becomes `minimal`. This is the only template-level
change in this slice.

#### 2. New module: `apps/outfitter/src/targets/`

Three new files: `types.ts`, `registry.ts`, `index.ts`, plus tests. No existing files are
modified in this slice -- the registry exists alongside the old preset system.

#### 3. Backward-compatible bridge (Slice 2, not this slice)

In Slice 2 (init consolidation), the following changes happen:

- `actions.ts`: The `createInputSchema` preset enum expands. The `--preset` values map through
  the registry. `"basic"` is accepted as an alias for `"minimal"` with a deprecation warning.
- `init.ts`: `resolveTemplateName()` becomes `resolveTarget()` and uses the registry.
- `create/presets.ts`: Becomes a thin re-export adapter over the target registry (or is removed
  outright if Slice 2 and Slice 7 happen in the same PR).

#### 4. Action registry changes (Slice 2)

The `init.cli`, `init.mcp`, `init.daemon` subcommand actions change from:

```typescript
createInitAction({
  id: "init.cli",
  templateOverride: "cli",
})
```

To:

```typescript
createInitAction({
  id: "init.cli",
  targetOverride: "cli",   // resolved through registry
})
```

The `templateOverride` parameter becomes `targetOverride`. Inside `createInitAction`, the
target is resolved via `getInitTarget(targetOverride)`.

### What Is Backward Compatible

- **`init` with `--template basic`**: Works. The registry maps `"basic"` -> `"minimal"` or
  the template directory check finds `minimal/` after the rename. (Depends on whether we add an
  alias. Recommended: add `"basic"` as a deprecated alias in the `getTarget` function.)
- **`init cli`, `init mcp`, `init daemon`**: Unchanged behavior. The subcommands resolve to
  the same templates via the registry.
- **`create` with `--preset basic|cli|mcp|daemon`**: Unchanged in this slice. The create
  planner still uses `create/presets.ts` until Slice 2 migrates it.

### What Is Breaking

- **`templates/basic/` directory rename**: Any external tooling or scripts that reference
  `templates/basic/` by path will break. This is internal to the monorepo and unlikely to
  affect downstream users.
- **Future: `--preset basic` deprecation**: Not breaking in this slice, but the plan is to
  deprecate `basic` in favor of `minimal` in Slice 2. The deprecation warning gives users
  time to migrate.

## Relationship to `create/presets.ts`

The current preset system lives in `apps/outfitter/src/create/presets.ts`:

```typescript
export type CreatePresetId = "basic" | "cli" | "daemon" | "mcp";

export interface CreatePresetDefinition {
  readonly id: CreatePresetId;
  readonly template: CreatePresetId;
  readonly summary: string;
  readonly defaultBlocks: readonly string[];
}
```

The target registry is a strict superset:

| Preset field | Target field | Notes |
|---|---|---|
| `id` | `id` | Same concept, expanded union |
| `template` | `templateDir` | Renamed for clarity |
| `summary` | `description` | Renamed for consistency |
| `defaultBlocks` | `defaultBlocks` | Same |
| -- | `category` | New: runnable vs library |
| -- | `placement` | New: apps/ vs packages/ |
| -- | `status` | New: ready vs stub |
| -- | `scope` | New: init-only, scaffold-only, both |

The `create/presets.ts` module is not deleted in this slice. It continues to work for the
`create` command. In Slice 2, either:

- (a) `presets.ts` re-exports a mapped view of the target registry, or
- (b) `presets.ts` is deleted and the planner is updated to use the registry directly.

Option (b) is preferred for simplicity.

## Compatibility Alias for `basic`

To avoid a hard break when users pass `--template basic` or `--preset basic`, the `getTarget`
function should recognize `basic` as an alias for `minimal`:

```typescript
const TARGET_ALIASES: ReadonlyMap<string, TargetId> = new Map([
  ["basic", "minimal"],
]);

export function getTarget(id: string): Result<TargetDefinition, NotFoundError> {
  const resolvedId = TARGET_ALIASES.get(id) ?? id;
  const target = TARGET_REGISTRY.get(resolvedId as TargetId);
  if (!target) {
    return Result.err(
      new NotFoundError({
        message: `Unknown target '${id}'. Available targets: ${TARGET_IDS.join(", ")}`,
        resourceType: "target",
        resourceId: id,
      }),
    );
  }
  return Result.ok(target);
}
```

This keeps `basic` working transparently. A deprecation warning can be added at the consumer
level (init/create) rather than in the registry itself, since the registry is a data layer.

## Implementation Checklist

1. Create `apps/outfitter/src/targets/types.ts` with types
2. Create `apps/outfitter/src/targets/registry.ts` with the full registry and lookup functions
3. Create `apps/outfitter/src/targets/index.ts` barrel export
4. Rename `templates/basic/` to `templates/minimal/`
5. Write `apps/outfitter/src/targets/__tests__/registry.test.ts`
6. Verify existing `create` and `init` tests still pass (no changes to those modules yet)
7. Run full test suite: `bun run test`
