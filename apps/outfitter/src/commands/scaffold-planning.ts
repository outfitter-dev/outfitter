import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import { OperationCollector } from "../engine/collector.js";
import {
  buildWorkspaceRootPackageJson,
  deriveBinName,
  deriveProjectName,
  isPathWithin,
  resolveAuthor,
  resolveYear,
  sanitizePackageName,
  type ScaffoldPlan,
  validatePackageName,
  validateProjectDirectoryName,
} from "../engine/index.js";
import {
  detectWorkspaceRoot,
  getWorkspacePatterns,
  hasWorkspacesField,
} from "../engine/workspace.js";
import type { TargetDefinition } from "../targets/index.js";
import { parseBlocks } from "./init-option-resolution.js";

interface PackageJsonData {
  readonly bin?: string | Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly name?: string;
  readonly outfitter?: unknown;
  readonly private?: boolean;
  readonly scripts?: Record<string, string>;
  readonly version?: string;
  readonly workspaces?: string[] | { packages?: string[] };
  readonly [key: string]: unknown;
}

interface PresetMetadata {
  readonly kind?: "runnable" | "library";
  readonly placement?: "apps" | "packages";
  readonly surfaces?: readonly ("cli" | "mcp" | "daemon")[];
}

/** Discriminated union describing the detected project layout at a given directory. */
export type ProjectStructure =
  | {
      readonly kind: "workspace";
      readonly rootDir: string;
      readonly workspacePatterns: readonly string[];
    }
  | {
      readonly kind: "single-package";
      readonly rootDir: string;
      readonly packageJson: Record<string, unknown>;
    }
  | {
      readonly kind: "none";
      readonly rootDir: string;
    };

interface ScaffoldPlanningOptions {
  readonly local?: boolean | undefined;
  readonly noTooling?: boolean | undefined;
  readonly with?: string | undefined;
}

function readPackageJson(path: string): PackageJsonData | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PackageJsonData;
  } catch {
    return null;
  }
}

/**
 * Detects whether the given directory is a workspace root, a single package,
 * or has no package.json at all. Walks up to find workspace roots when needed.
 */
export function detectProjectStructure(
  cwd: string
): Result<ProjectStructure, string> {
  const resolvedCwd = resolve(cwd);
  const cwdPackageJsonPath = join(resolvedCwd, "package.json");
  const cwdPkg = readPackageJson(cwdPackageJsonPath);

  if (cwdPkg) {
    if (hasWorkspacesField(cwdPkg)) {
      return Result.ok({
        kind: "workspace",
        rootDir: resolvedCwd,
        workspacePatterns: getWorkspacePatterns(cwdPkg.workspaces),
      });
    }

    const wsResult = detectWorkspaceRoot(resolvedCwd);
    if (wsResult.isErr()) {
      return Result.err(wsResult.error.message);
    }
    if (wsResult.value) {
      const rootPkg = readPackageJson(join(wsResult.value, "package.json"));
      if (rootPkg) {
        return Result.ok({
          kind: "workspace",
          rootDir: wsResult.value,
          workspacePatterns: getWorkspacePatterns(rootPkg.workspaces),
        });
      }
    }

    return Result.ok({
      kind: "single-package",
      rootDir: resolvedCwd,
      packageJson: cwdPkg,
    });
  }

  const wsResult = detectWorkspaceRoot(resolvedCwd);
  if (wsResult.isErr()) {
    return Result.err(wsResult.error.message);
  }
  if (wsResult.value) {
    const rootPkg = readPackageJson(join(wsResult.value, "package.json"));
    if (rootPkg) {
      return Result.ok({
        kind: "workspace",
        rootDir: wsResult.value,
        workspacePatterns: getWorkspacePatterns(rootPkg.workspaces),
      });
    }
  }

  return Result.ok({ kind: "none", rootDir: resolvedCwd });
}

function detectExistingCategory(pkg: PackageJsonData): "runnable" | "library" {
  const metadata = readPresetMetadata(pkg);
  if (metadata?.kind) {
    return metadata.kind;
  }
  if (metadata?.placement === "apps") {
    return "runnable";
  }
  if (metadata?.placement === "packages") {
    return "library";
  }
  if (metadata?.surfaces && metadata.surfaces.length > 0) {
    return "runnable";
  }

  if (pkg.bin) {
    if (typeof pkg.bin === "string") {
      return "runnable";
    }
    if (typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0) {
      return "runnable";
    }
  }

  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  if (deps["@modelcontextprotocol/sdk"] || deps["@outfitter/mcp"]) {
    return "runnable";
  }

  return "library";
}

function readPresetMetadata(pkg: PackageJsonData): PresetMetadata | null {
  const outfitter = pkg.outfitter;
  if (!outfitter || typeof outfitter !== "object" || Array.isArray(outfitter)) {
    return null;
  }

  const template = (outfitter as Record<string, unknown>)["template"];
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    return null;
  }

  const templateRecord = template as Record<string, unknown>;
  const kind =
    templateRecord["kind"] === "runnable" ||
    templateRecord["kind"] === "library"
      ? templateRecord["kind"]
      : undefined;
  const placement =
    templateRecord["placement"] === "apps" ||
    templateRecord["placement"] === "packages"
      ? templateRecord["placement"]
      : undefined;
  const surfaces = parsePresetSurfaces(templateRecord["surfaces"]);

  const hasMetadata =
    kind !== undefined ||
    placement !== undefined ||
    (surfaces !== undefined && surfaces.length > 0);
  if (!hasMetadata) {
    return null;
  }

  return {
    ...(kind ? { kind } : {}),
    ...(placement ? { placement } : {}),
    ...(surfaces ? { surfaces } : {}),
  };
}

function parsePresetSurfaces(
  value: unknown
): readonly ("cli" | "mcp" | "daemon")[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const surfaces = value.filter(
    (entry): entry is "cli" | "mcp" | "daemon" =>
      entry === "cli" || entry === "mcp" || entry === "daemon"
  );
  return surfaces.length === value.length ? surfaces : undefined;
}

/**
 * Ensures the workspace root package.json includes the given placement pattern (e.g. "apps/*").
 * @returns `true` if the pattern was added, `false` if it already existed.
 */
export function ensureWorkspacePattern(
  rootDir: string,
  placement: "apps" | "packages",
  dryRun: boolean,
  collector?: OperationCollector
): Result<boolean, string> {
  const packageJsonPath = join(rootDir, "package.json");
  const pkg = readPackageJson(packageJsonPath);
  if (!pkg) {
    if (dryRun) {
      collector?.add({
        type: "config-inject",
        target: packageJsonPath,
        description: `Ensure workspace pattern '${placement}/*'`,
      });
      return Result.ok(true);
    }

    return Result.err("Failed to read workspace package.json");
  }

  const pattern = `${placement}/*`;
  const patterns = [...getWorkspacePatterns(pkg.workspaces)];
  if (patterns.includes(pattern)) {
    return Result.ok(false);
  }

  if (dryRun) {
    collector?.add({
      type: "config-inject",
      target: packageJsonPath,
      description: `Add workspace pattern '${pattern}'`,
    });
    return Result.ok(true);
  }

  const workspaces = pkg.workspaces;
  const nextPatterns = [...patterns, pattern];
  const nextPkg: Record<string, unknown> = { ...pkg };
  if (Array.isArray(workspaces)) {
    nextPkg["workspaces"] = nextPatterns;
  } else if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    nextPkg["workspaces"] = {
      ...(workspaces as Record<string, unknown>),
      packages: nextPatterns,
    };
  } else {
    nextPkg["workspaces"] = nextPatterns;
  }

  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(nextPkg, null, 2)}\n`,
    "utf-8"
  );
  return Result.ok(true);
}

function movePath(source: string, destination: string): void {
  try {
    renameSync(source, destination);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "EXDEV"
    ) {
      cpSync(source, destination, { recursive: true });
      rmSync(source, { recursive: true, force: true });
      return;
    }
    throw error;
  }
}

/**
 * Converts a single-package directory into a workspace by moving existing files
 * into the appropriate `apps/` or `packages/` subdirectory and creating a workspace root.
 * Rolls back on failure.
 */
export function convertToWorkspace(
  rootDir: string,
  existingPkg: Record<string, unknown>,
  dryRun: boolean,
  collector?: OperationCollector
): Result<
  {
    movedExisting: {
      from: string;
      to: string;
      name: string;
    };
  },
  string
> {
  const parentWorkspace = detectWorkspaceRoot(dirname(rootDir));
  if (parentWorkspace.isErr()) {
    return Result.err(parentWorkspace.error.message);
  }
  if (parentWorkspace.value && parentWorkspace.value !== rootDir) {
    return Result.err(
      `Cannot convert to workspace: already inside workspace at '${parentWorkspace.value}'`
    );
  }

  const category = detectExistingCategory(existingPkg as PackageJsonData);
  const placement = category === "runnable" ? "apps" : "packages";
  const existingName = deriveProjectName(
    (existingPkg as PackageJsonData).name ?? basename(rootDir)
  );
  const invalidExistingName = validateProjectDirectoryName(existingName);
  if (invalidExistingName) {
    return Result.err(
      `Invalid existing project name '${existingName}': ${invalidExistingName}`
    );
  }
  const destinationBaseDir = resolve(rootDir, placement);
  const destinationDir = resolve(destinationBaseDir, existingName);
  if (!isPathWithin(destinationBaseDir, destinationDir)) {
    return Result.err(
      `Invalid existing project name '${existingName}': path escapes '${destinationBaseDir}'`
    );
  }

  const entries = readdirSync(rootDir);
  const preserve = new Set([".git", "node_modules", ".outfitter", "bun.lock"]);
  const toMove = entries.filter((entry) => !preserve.has(entry));

  if (dryRun) {
    collector?.add({
      type: "dir-create",
      path: join(rootDir, "apps"),
    });
    collector?.add({
      type: "dir-create",
      path: join(rootDir, "packages"),
    });
    for (const entry of toMove) {
      collector?.add({
        type: "file-overwrite",
        path: join(destinationDir, entry),
        source: "generated",
      });
    }
    collector?.add({
      type: "file-overwrite",
      path: join(rootDir, "package.json"),
      source: "generated",
    });
    return Result.ok({
      movedExisting: {
        from: rootDir,
        to: destinationDir,
        name: existingName,
      },
    });
  }

  const stagingDir = join(rootDir, `.outfitter-staging-${Date.now()}`);
  try {
    mkdirSync(stagingDir, { recursive: true });
    for (const entry of toMove) {
      movePath(join(rootDir, entry), join(stagingDir, entry));
    }

    mkdirSync(join(rootDir, "apps"), { recursive: true });
    mkdirSync(join(rootDir, "packages"), { recursive: true });
    mkdirSync(destinationDir, { recursive: true });

    for (const entry of toMove) {
      movePath(join(stagingDir, entry), join(destinationDir, entry));
    }
    rmSync(stagingDir, { recursive: true, force: true });

    writeFileSync(
      join(rootDir, "package.json"),
      buildWorkspaceRootPackageJson(`${existingName}-workspace`),
      "utf-8"
    );

    const gitignorePath = join(rootDir, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(
        gitignorePath,
        "node_modules\n**/dist\n.outfitter-staging-*\n",
        "utf-8"
      );
    }

    const bunLockPath = join(rootDir, "bun.lock");
    if (existsSync(bunLockPath)) {
      unlinkSync(bunLockPath);
    }
  } catch (error) {
    try {
      if (existsSync(stagingDir)) {
        const stagedEntries = readdirSync(stagingDir);
        for (const entry of stagedEntries) {
          movePath(join(stagingDir, entry), join(rootDir, entry));
        }
        rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {
      // Best effort rollback.
    }
    return Result.err(
      `Workspace conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return Result.ok({
    movedExisting: {
      from: rootDir,
      to: destinationDir,
      name: existingName,
    },
  });
}

/**
 * Builds a scaffold plan for a target within a workspace, including preset
 * copying, shared config injection, and optional tooling blocks.
 */
export function buildScaffoldPlan(
  target: TargetDefinition,
  rootDir: string,
  targetName: string,
  options: ScaffoldPlanningOptions
): ScaffoldPlan {
  const targetDir = join(rootDir, target.placement, targetName);
  const packageName = targetName;
  const projectName = deriveProjectName(packageName);
  const blocks = options.noTooling
    ? []
    : (parseBlocks(options.with) ?? [...target.defaultBlocks]);

  return {
    values: {
      name: projectName,
      projectName,
      packageName,
      binName: deriveBinName(projectName),
      version: "0.1.0",
      description: `${target.description} scaffolded with Outfitter`,
      author: resolveAuthor(),
      year: resolveYear(),
    },
    changes: [
      {
        type: "copy-preset",
        preset: target.presetDir,
        targetDir,
        includeTooling: !options.noTooling,
        overlayBaseTemplate: true,
      },
      { type: "inject-shared-config" },
      ...(options.local
        ? ([{ type: "rewrite-local-dependencies", mode: "workspace" }] as const)
        : []),
      ...(blocks.length > 0 ? ([{ type: "add-blocks", blocks }] as const) : []),
    ],
  };
}

/**
 * Validates that a scaffold target name is safe as both a directory name and an npm package name.
 * Suggests a sanitized alternative when the name is invalid.
 */
export function validateScaffoldTargetName(
  targetName: string
): Result<void, string> {
  const invalidTargetName = validateProjectDirectoryName(targetName);
  if (invalidTargetName) {
    return Result.err(
      `Invalid target name '${targetName}': ${invalidTargetName}`
    );
  }

  const invalidPackageName = validatePackageName(targetName);
  if (invalidPackageName) {
    const suggested = sanitizePackageName(targetName);
    const suggestion =
      suggested.length > 0 && suggested !== targetName
        ? ` Try '${suggested}'.`
        : "";
    return Result.err(
      `Invalid package name '${targetName}': ${invalidPackageName}.${suggestion}`
    );
  }

  return Result.ok(undefined);
}
