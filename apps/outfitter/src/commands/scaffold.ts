/**
 * `outfitter scaffold` - Add a capability to an existing project.
 *
 * @packageDocumentation
 */

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
import { exitWithError, output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";
import { OperationCollector } from "../engine/collector.js";
import {
  buildWorkspaceRootPackageJson,
  deriveBinName,
  deriveProjectName,
  executePlan,
  resolveAuthor,
  resolveYear,
  type ScaffoldPlan,
} from "../engine/index.js";
import type { PostScaffoldResult } from "../engine/post-scaffold.js";
import { runPostScaffold } from "../engine/post-scaffold.js";
import { renderOperationPlan } from "../engine/render-plan.js";
import {
  detectWorkspaceRoot,
  scaffoldWorkspaceRoot,
} from "../engine/workspace.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { getScaffoldTarget, type TargetDefinition } from "../targets/index.js";

interface PackageJsonData {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly workspaces?: string[] | { packages?: string[] };
  readonly bin?: string | Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly [key: string]: unknown;
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
  | {
      readonly kind: "none";
      readonly rootDir: string;
    };

export interface ScaffoldOptions {
  readonly target: string;
  readonly name?: string | undefined;
  readonly force: boolean;
  readonly skipInstall: boolean;
  readonly dryRun: boolean;
  readonly with?: string | undefined;
  readonly noTooling?: boolean | undefined;
  readonly local?: boolean | undefined;
  readonly cwd: string;
  readonly installTimeout?: number | undefined;
}

export interface ScaffoldCommandResult {
  readonly target: string;
  readonly rootDir: string;
  readonly targetDir: string;
  readonly converted: boolean;
  readonly movedExisting?:
    | {
        readonly from: string;
        readonly to: string;
        readonly name: string;
      }
    | undefined;
  readonly workspacePatternsUpdated: boolean;
  readonly blocksAdded?: AddBlockResult | undefined;
  readonly postScaffold: PostScaffoldResult;
  readonly dryRunPlan?:
    | {
        readonly operations: readonly unknown[];
        readonly summary: Record<string, number>;
      }
    | undefined;
}

export class ScaffoldCommandError extends Error {
  readonly _tag = "ScaffoldCommandError" as const;

  constructor(message: string) {
    super(message);
    this.name = "ScaffoldCommandError";
  }
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

function hasWorkspacesField(pkg: PackageJsonData): boolean {
  const workspaces = pkg.workspaces;
  if (Array.isArray(workspaces) && workspaces.length > 0) {
    return true;
  }
  if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    return Array.isArray(packages) && packages.length > 0;
  }
  return false;
}

function extractWorkspacePatterns(pkg: PackageJsonData): readonly string[] {
  const workspaces = pkg.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.filter(
      (entry): entry is string => typeof entry === "string"
    );
  }
  if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.filter(
        (entry): entry is string => typeof entry === "string"
      );
    }
  }
  return [];
}

function detectProjectStructure(
  cwd: string
): Result<ProjectStructure, ScaffoldCommandError> {
  const resolvedCwd = resolve(cwd);
  const cwdPackageJsonPath = join(resolvedCwd, "package.json");
  const cwdPkg = readPackageJson(cwdPackageJsonPath);

  if (cwdPkg) {
    if (hasWorkspacesField(cwdPkg)) {
      return Result.ok({
        kind: "workspace",
        rootDir: resolvedCwd,
        workspacePatterns: extractWorkspacePatterns(cwdPkg),
      });
    }

    const wsResult = detectWorkspaceRoot(resolvedCwd);
    if (wsResult.isErr()) {
      return Result.err(new ScaffoldCommandError(wsResult.error.message));
    }
    if (wsResult.value) {
      const rootPkg = readPackageJson(join(wsResult.value, "package.json"));
      if (rootPkg) {
        return Result.ok({
          kind: "workspace",
          rootDir: wsResult.value,
          workspacePatterns: extractWorkspacePatterns(rootPkg),
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
    return Result.err(new ScaffoldCommandError(wsResult.error.message));
  }
  if (wsResult.value) {
    const rootPkg = readPackageJson(join(wsResult.value, "package.json"));
    if (rootPkg) {
      return Result.ok({
        kind: "workspace",
        rootDir: wsResult.value,
        workspacePatterns: extractWorkspacePatterns(rootPkg),
      });
    }
  }

  return Result.ok({ kind: "none", rootDir: resolvedCwd });
}

function detectExistingCategory(pkg: PackageJsonData): "runnable" | "library" {
  if (pkg.bin) {
    if (typeof pkg.bin === "string") {
      return "runnable";
    }
    if (typeof pkg.bin === "object" && Object.keys(pkg.bin).length > 0) {
      return "runnable";
    }
  }

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  if (deps["@modelcontextprotocol/sdk"]) {
    return "runnable";
  }

  return "library";
}

function ensureWorkspacePattern(
  rootDir: string,
  placement: "apps" | "packages",
  dryRun: boolean,
  collector?: OperationCollector
): Result<boolean, ScaffoldCommandError> {
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

    return Result.err(
      new ScaffoldCommandError("Failed to read workspace package.json")
    );
  }

  const pattern = `${placement}/*`;
  const patterns = [...extractWorkspacePatterns(pkg)];
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

function convertToWorkspace(
  rootDir: string,
  existingPkg: PackageJsonData,
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
  ScaffoldCommandError
> {
  const parentWorkspace = detectWorkspaceRoot(dirname(rootDir));
  if (parentWorkspace.isErr()) {
    return Result.err(new ScaffoldCommandError(parentWorkspace.error.message));
  }
  if (parentWorkspace.value && parentWorkspace.value !== rootDir) {
    return Result.err(
      new ScaffoldCommandError(
        `Cannot convert to workspace: already inside workspace at '${parentWorkspace.value}'`
      )
    );
  }

  const category = detectExistingCategory(existingPkg);
  const placement = category === "runnable" ? "apps" : "packages";
  const existingName = deriveProjectName(existingPkg.name ?? basename(rootDir));
  const destinationDir = join(rootDir, placement, existingName);

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
      new ScaffoldCommandError(
        `Workspace conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
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

function parseBlocks(
  withFlag: string | undefined
): readonly string[] | undefined {
  if (!withFlag) {
    return undefined;
  }

  const blocks = withFlag
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return blocks.length > 0 ? blocks : undefined;
}

function buildScaffoldPlan(
  target: TargetDefinition,
  rootDir: string,
  targetName: string,
  options: ScaffoldOptions
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
        type: "copy-template",
        template: target.templateDir,
        targetDir,
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

export async function runScaffold(
  options: ScaffoldOptions
): Promise<Result<ScaffoldCommandResult, ScaffoldCommandError>> {
  const targetResult = getScaffoldTarget(options.target);
  if (targetResult.isErr()) {
    return Result.err(new ScaffoldCommandError(targetResult.error.message));
  }
  const target = targetResult.value;

  const targetName = deriveProjectName(options.name ?? target.id);
  const structureResult = detectProjectStructure(options.cwd);
  if (structureResult.isErr()) {
    return structureResult;
  }

  const dryRun = options.dryRun;
  const collector = dryRun ? new OperationCollector() : undefined;

  let rootDir = resolve(options.cwd);
  let converted = false;
  let movedExisting: ScaffoldCommandResult["movedExisting"];
  let workspacePatternsUpdated = false;

  if (structureResult.value.kind === "workspace") {
    rootDir = structureResult.value.rootDir;
    const patternResult = ensureWorkspacePattern(
      rootDir,
      target.placement,
      dryRun,
      collector
    );
    if (patternResult.isErr()) {
      return patternResult;
    }
    workspacePatternsUpdated = patternResult.value;
  } else if (structureResult.value.kind === "single-package") {
    const conversionResult = convertToWorkspace(
      structureResult.value.rootDir,
      structureResult.value.packageJson,
      dryRun,
      collector
    );
    if (conversionResult.isErr()) {
      return conversionResult;
    }
    rootDir = structureResult.value.rootDir;
    converted = true;
    movedExisting = conversionResult.value.movedExisting;
  } else {
    const workspaceName = `${basename(rootDir)}-workspace`;
    if (dryRun) {
      const packageJsonPath = join(rootDir, "package.json");
      if (existsSync(packageJsonPath) && !options.force) {
        return Result.err(
          new ScaffoldCommandError(
            `Directory '${rootDir}' already has a package.json. Use --force to overwrite.`
          )
        );
      }
      collector?.add({
        type: "dir-create",
        path: join(rootDir, "apps"),
      });
      collector?.add({
        type: "dir-create",
        path: join(rootDir, "packages"),
      });
      collector?.add(
        existsSync(packageJsonPath)
          ? {
              type: "file-overwrite",
              path: packageJsonPath,
              source: "generated",
            }
          : {
              type: "file-create",
              path: packageJsonPath,
              source: "generated",
            }
      );
      const gitignorePath = join(rootDir, ".gitignore");
      if (options.force || !existsSync(gitignorePath)) {
        collector?.add(
          existsSync(gitignorePath)
            ? {
                type: "file-overwrite",
                path: gitignorePath,
                source: "generated",
              }
            : {
                type: "file-create",
                path: gitignorePath,
                source: "generated",
              }
        );
      }
    } else {
      const workspaceResult = scaffoldWorkspaceRoot(
        rootDir,
        workspaceName,
        options.force
      );
      if (workspaceResult.isErr()) {
        return Result.err(
          new ScaffoldCommandError(workspaceResult.error.message)
        );
      }
    }

    converted = true;
  }

  const targetDir = join(rootDir, target.placement, targetName);
  if (existsSync(targetDir) && !options.force && !dryRun) {
    return Result.err(
      new ScaffoldCommandError(
        `'${target.placement}/${targetName}/' already exists. Use --force to overwrite.`
      )
    );
  }

  const plan = buildScaffoldPlan(target, rootDir, targetName, options);
  const executeResult = await executePlan(plan, {
    force: options.force,
    ...(collector ? { collector } : {}),
  });
  if (executeResult.isErr()) {
    return Result.err(new ScaffoldCommandError(executeResult.error.message));
  }

  const postScaffoldResult = await runPostScaffold(
    {
      rootDir,
      projectDir: targetDir,
      origin: "scaffold",
      target: target.id,
      structure: "workspace",
      skipInstall: options.skipInstall,
      skipGit: true,
      skipCommit: true,
      dryRun,
      installTimeoutMs: options.installTimeout ?? 60_000,
    },
    collector
  );
  if (postScaffoldResult.isErr()) {
    return Result.err(new ScaffoldCommandError("Post-scaffold step failed"));
  }

  return Result.ok({
    target: target.id,
    rootDir,
    targetDir,
    converted,
    movedExisting,
    workspacePatternsUpdated,
    blocksAdded: executeResult.value.blocksAdded,
    postScaffold: postScaffoldResult.value,
    ...(collector ? { dryRunPlan: collector.toJSON() } : {}),
  });
}

export async function printScaffoldResults(
  result: ScaffoldCommandResult,
  options?: { readonly mode?: OutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (result.dryRunPlan) {
    if (structuredMode) {
      await output(
        {
          target: result.target,
          rootDir: result.rootDir,
          targetDir: result.targetDir,
          converted: result.converted,
          movedExisting: result.movedExisting ?? null,
          ...result.dryRunPlan,
        },
        { mode: structuredMode }
      );
      return;
    }

    const collector = new OperationCollector();
    for (const op of result.dryRunPlan.operations) {
      collector.add(op as never);
    }
    await renderOperationPlan(collector, { rootDir: result.rootDir });
    return;
  }

  if (structuredMode) {
    await output(
      {
        target: result.target,
        rootDir: result.rootDir,
        targetDir: result.targetDir,
        converted: result.converted,
        movedExisting: result.movedExisting ?? null,
        workspacePatternsUpdated: result.workspacePatternsUpdated,
        blocksAdded: result.blocksAdded ?? null,
        postScaffold: result.postScaffold,
        nextSteps: result.postScaffold.nextSteps,
      },
      { mode: structuredMode }
    );
    return;
  }

  const lines: string[] = [];
  if (result.converted) {
    lines.push("Converted to workspace structure:");
    if (result.movedExisting) {
      lines.push(`  Moved existing package -> ${result.movedExisting.to}`);
    }
    lines.push("  Created workspace root package.json");
    lines.push("");
  }

  lines.push(`Scaffolded ${result.targetDir}`);
  if (result.blocksAdded && result.blocksAdded.created.length > 0) {
    lines.push(`Added ${result.blocksAdded.created.length} tooling file(s):`);
    for (const created of result.blocksAdded.created) {
      lines.push(`  + ${created}`);
    }
  }

  lines.push("", "Next steps:");
  for (const step of result.postScaffold.nextSteps) {
    lines.push(`  ${step}`);
  }

  await output(lines);
}

export function scaffoldCommand(program: Command): void {
  interface ScaffoldCommandFlags {
    force?: boolean;
    skipInstall?: boolean;
    dryRun?: boolean;
    with?: string;
    noTooling?: boolean;
    local?: boolean;
    installTimeout?: number;
    json?: boolean;
  }

  program
    .command("scaffold <target> [name]")
    .description("Add a capability to an existing project")
    .option("-f, --force", "Overwrite existing files", false)
    .option("--skip-install", "Skip bun install", false)
    .option("--dry-run", "Preview changes without executing", false)
    .option("--with <blocks>", "Comma-separated tooling blocks to add")
    .option("--no-tooling", "Skip default tooling blocks")
    .option("--local", "Use workspace:* for @outfitter dependencies")
    .option("--install-timeout <ms>", "bun install timeout in ms")
    .option("--json", "Output as JSON", false)
    .action(
      async (
        target: string,
        name: string | undefined,
        flags: ScaffoldCommandFlags
      ) => {
        const mode: OutputMode | undefined = flags.json ? "json" : undefined;
        const outputOptions = mode ? { mode } : undefined;
        const result = await runScaffold({
          target,
          name,
          force: Boolean(flags.force),
          skipInstall: Boolean(flags.skipInstall),
          dryRun: Boolean(flags.dryRun),
          with: flags.with,
          noTooling: flags.noTooling,
          local: flags.local,
          cwd: process.cwd(),
          ...(flags.installTimeout !== undefined
            ? { installTimeout: flags.installTimeout }
            : {}),
        });

        if (result.isErr()) {
          exitWithError(result.error, outputOptions);
          return;
        }

        await printScaffoldResults(result.value, outputOptions);
      }
    );
}
