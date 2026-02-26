import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";

import { OperationCollector } from "../engine/collector.js";
import {
  deriveBinName,
  deriveProjectName,
  executePlan,
  isPathWithin,
  resolveAuthor,
  resolveYear,
  type ScaffoldPlan,
  scaffoldWorkspaceRoot,
  validateProjectDirectoryName,
} from "../engine/index.js";
import type { PostScaffoldResult } from "../engine/post-scaffold.js";
import { runPostScaffold } from "../engine/post-scaffold.js";
import type { TargetDefinition } from "../targets/index.js";
import type { InitPresetId } from "./init-option-resolution.js";

export type InitStructure = "single" | "workspace";

export interface ResolvedInitExecutionInput {
  readonly binName?: string | undefined;
  readonly blocksOverride?: readonly string[];
  readonly includeTooling: boolean;
  readonly local: boolean;
  readonly packageName: string;
  readonly preset: InitPresetId;
  readonly rootDir: string;
  readonly structure: InitStructure;
  readonly workspaceName?: string | undefined;
}

export interface InitExecutionOptions {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly installTimeout: number;
  readonly skipCommit: boolean;
  readonly skipGit: boolean;
  readonly skipInstall: boolean;
}

export interface InitExecutionResult {
  readonly blocksAdded?: AddBlockResult | undefined;
  readonly dryRunPlan?:
    | {
        readonly operations: readonly unknown[];
        readonly summary: Record<string, number>;
      }
    | undefined;
  readonly packageName: string;
  readonly postScaffold: PostScaffoldResult;
  readonly preset: InitPresetId;
  readonly projectDir: string;
  readonly rootDir: string;
  readonly structure: InitStructure;
}

function toExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown init error";
}

function buildInitPlan(
  target: TargetDefinition,
  input: ResolvedInitExecutionInput,
  projectDir: string,
  resolvedBinName: string
): ScaffoldPlan {
  const blocks = input.includeTooling
    ? (input.blocksOverride ?? [...target.defaultBlocks])
    : [];

  return {
    values: {
      name: deriveProjectName(input.packageName),
      projectName: deriveProjectName(input.packageName),
      packageName: input.packageName,
      binName: resolvedBinName,
      version: "0.1.0",
      description: "A new project created with Outfitter",
      author: resolveAuthor(),
      year: resolveYear(),
    },
    changes: [
      {
        type: "copy-preset",
        preset: target.presetDir,
        targetDir: projectDir,
        includeTooling: input.includeTooling,
        overlayBaseTemplate: true,
      },
      { type: "inject-shared-config" },
      ...(input.local
        ? ([{ type: "rewrite-local-dependencies", mode: "workspace" }] as const)
        : []),
      ...(blocks.length > 0 ? ([{ type: "add-blocks", blocks }] as const) : []),
    ],
  };
}

export async function executeInitPipeline(
  input: ResolvedInitExecutionInput,
  target: TargetDefinition,
  options: InitExecutionOptions
): Promise<Result<InitExecutionResult, string>> {
  const projectName = deriveProjectName(input.packageName);
  if (input.structure === "workspace") {
    const invalidProjectName = validateProjectDirectoryName(projectName);
    if (invalidProjectName) {
      return Result.err(
        `Invalid workspace project name '${projectName}': ${invalidProjectName}`
      );
    }
  }

  const collector = options.dryRun ? new OperationCollector() : undefined;

  const projectBaseDir = resolve(input.rootDir, target.placement);
  const resolvedProjectDir = resolve(projectBaseDir, projectName);
  if (
    input.structure === "workspace" &&
    !isPathWithin(projectBaseDir, resolvedProjectDir)
  ) {
    return Result.err(
      `Invalid workspace project name '${projectName}': path escapes '${projectBaseDir}'`
    );
  }

  const projectDir =
    input.structure === "workspace" ? resolvedProjectDir : input.rootDir;

  if (input.structure === "single") {
    if (existsSync(join(input.rootDir, "package.json")) && !options.force) {
      return Result.err(
        `Directory '${input.rootDir}' already has a package.json. Use --force to overwrite, or use 'outfitter add' for existing projects.`
      );
    }
  } else {
    const workspaceName = input.workspaceName ?? basename(input.rootDir);
    const workspacePackageJsonPath = join(input.rootDir, "package.json");
    if (options.dryRun) {
      if (existsSync(workspacePackageJsonPath) && !options.force) {
        return Result.err(
          `Directory '${input.rootDir}' already has a package.json. Use --force to overwrite.`
        );
      }

      collector?.add({
        type: "dir-create",
        path: join(input.rootDir, "apps"),
      });
      collector?.add({
        type: "dir-create",
        path: join(input.rootDir, "packages"),
      });
      collector?.add(
        existsSync(workspacePackageJsonPath)
          ? {
              type: "file-overwrite",
              path: workspacePackageJsonPath,
              source: "generated",
            }
          : {
              type: "file-create",
              path: workspacePackageJsonPath,
              source: "generated",
            }
      );

      const readmePath = join(input.rootDir, "README.md");
      if (options.force || !existsSync(readmePath)) {
        collector?.add(
          existsSync(readmePath)
            ? {
                type: "file-overwrite",
                path: readmePath,
                source: "generated",
              }
            : {
                type: "file-create",
                path: readmePath,
                source: "generated",
              }
        );
      }

      const gitignorePath = join(input.rootDir, ".gitignore");
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
        input.rootDir,
        workspaceName,
        options.force
      );
      if (workspaceResult.isErr()) {
        return Result.err(workspaceResult.error.message);
      }
    }
  }

  const resolvedBinName =
    input.binName ?? deriveBinName(deriveProjectName(input.packageName));

  const plan = buildInitPlan(target, input, projectDir, resolvedBinName);

  const executeResult = await executePlan(plan, {
    force: options.force,
    ...(collector ? { collector } : {}),
  });

  if (executeResult.isErr()) {
    return Result.err(toExecutionErrorMessage(executeResult.error));
  }

  const postScaffoldResult = await runPostScaffold(
    {
      rootDir: input.rootDir,
      projectDir,
      origin: "init",
      target: input.preset,
      structure: input.structure,
      skipInstall: options.skipInstall,
      skipGit: options.skipGit,
      skipCommit: options.skipCommit,
      dryRun: options.dryRun,
      installTimeoutMs: options.installTimeout,
    },
    collector
  );
  if (postScaffoldResult.isErr()) {
    return Result.err("Post-scaffold step failed");
  }

  return Result.ok({
    structure: input.structure,
    rootDir: input.rootDir,
    projectDir,
    preset: input.preset,
    packageName: input.packageName,
    blocksAdded: executeResult.value.blocksAdded,
    postScaffold: postScaffoldResult.value,
    ...(collector ? { dryRunPlan: collector.toJSON() } : {}),
  });
}
