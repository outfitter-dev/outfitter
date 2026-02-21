import { NotFoundError, Result, ValidationError } from "@outfitter/contracts";
import type {
  TargetCategory,
  TargetDefinition,
  TargetId,
  TargetScope,
  TargetStatus,
} from "./types.js";

const TARGET_ALIASES: ReadonlyMap<string, TargetId> = new Map([
  ["basic", "minimal"],
  ["lib", "library"],
]);

export const TARGET_REGISTRY: ReadonlyMap<TargetId, TargetDefinition> = new Map<
  TargetId,
  TargetDefinition
>([
  [
    "minimal",
    {
      id: "minimal",
      description: "Minimal Bun + TypeScript project",
      category: "library",
      placement: "packages",
      presetDir: "minimal",
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
      presetDir: "cli",
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
      presetDir: "mcp",
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
      presetDir: "daemon",
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
      presetDir: "api",
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
      presetDir: "worker",
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
      presetDir: "web",
      defaultBlocks: ["scaffolding"],
      status: "stub",
      scope: "both",
    },
  ],
  [
    "library",
    {
      id: "library",
      description: "Reusable library package with Result handlers",
      category: "library",
      placement: "packages",
      presetDir: "library",
      defaultBlocks: ["scaffolding"],
      status: "ready",
      scope: "init-only",
    },
  ],
  [
    "full-stack",
    {
      id: "full-stack",
      description:
        "Workspace with CLI + MCP apps sharing a core handler package",
      category: "runnable",
      placement: "apps",
      presetDir: "full-stack",
      defaultBlocks: ["scaffolding"],
      status: "ready",
      scope: "init-only",
    },
  ],
]);

export const TARGET_IDS: readonly TargetId[] = [...TARGET_REGISTRY.keys()];

export const READY_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => TARGET_REGISTRY.get(id)?.status === "ready"
);

export const INIT_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter((id) => {
  const target = TARGET_REGISTRY.get(id);
  return target?.status === "ready" && target.scope !== "scaffold-only";
});

export const SCAFFOLD_TARGET_IDS: readonly TargetId[] = TARGET_IDS.filter(
  (id) => {
    const target = TARGET_REGISTRY.get(id);
    return target?.status === "ready" && target.scope !== "init-only";
  }
);

export function getTarget(id: string): Result<TargetDefinition, NotFoundError> {
  const resolvedId = TARGET_ALIASES.get(id) ?? id;
  const target = TARGET_REGISTRY.get(resolvedId as TargetId);
  if (!target) {
    return Result.err(
      new NotFoundError({
        message: `Unknown target '${id}'. Available targets: ${TARGET_IDS.join(", ")}`,
        resourceType: "target",
        resourceId: id,
      })
    );
  }
  return Result.ok(target);
}

export function getReadyTarget(
  id: string
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
          "It is planned but the preset has not been implemented. " +
          `Ready targets: ${READY_TARGET_IDS.join(", ")}`,
        field: "target",
      })
    );
  }

  return Result.ok(target);
}

export function getInitTarget(
  id: string
): Result<TargetDefinition, NotFoundError | ValidationError> {
  const targetResult = getReadyTarget(id);
  if (targetResult.isErr()) {
    return targetResult;
  }

  const target = targetResult.value;
  if (target.scope === "scaffold-only") {
    return Result.err(
      new ValidationError({
        message: `Target '${id}' cannot be used with init. Use 'outfitter scaffold ${id}' instead.`,
        field: "target",
      })
    );
  }

  return Result.ok(target);
}

export function getScaffoldTarget(
  id: string
): Result<TargetDefinition, NotFoundError | ValidationError> {
  const targetResult = getReadyTarget(id);
  if (targetResult.isErr()) {
    return targetResult;
  }

  const target = targetResult.value;
  if (target.scope === "init-only") {
    return Result.err(
      new ValidationError({
        message:
          `Target '${id}' cannot be scaffolded into an existing project. ` +
          `It is only available for new project creation via 'outfitter init'.`,
        field: "target",
      })
    );
  }

  return Result.ok(target);
}

export function resolvePlacement(
  target: TargetDefinition
): "apps" | "packages" {
  return target.placement;
}

export function listTargets(filter?: {
  readonly status?: TargetStatus;
  readonly scope?: TargetScope;
  readonly category?: TargetCategory;
}): readonly TargetDefinition[] {
  let targets = [...TARGET_REGISTRY.values()];

  if (filter?.status) {
    targets = targets.filter((target) => target.status === filter.status);
  }
  if (filter?.scope) {
    targets = targets.filter((target) => target.scope === filter.scope);
  }
  if (filter?.category) {
    targets = targets.filter((target) => target.category === filter.category);
  }

  return targets;
}
