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

// =============================================================================
// Example Overlays
// =============================================================================

/**
 * Maps preset IDs to their available example overlay names.
 * Each example has a directory under `packages/presets/presets/_examples/<preset>-<example>/`.
 */
const PRESET_EXAMPLES: ReadonlyMap<string, readonly string[]> = new Map([
  ["cli", ["todo"]],
  ["mcp", ["files"]],
]);

/**
 * Validates an `--example` flag value against the preset's available examples.
 * @returns The validated example overlay directory name, or an error message.
 */
export function validateExample(
  preset: string,
  example: string
): Result<string, string> {
  const available = PRESET_EXAMPLES.get(preset);
  if (!available || available.length === 0) {
    return Result.err(
      `Preset '${preset}' has no available examples. ` +
        `Only these presets support --example: ${[...PRESET_EXAMPLES.keys()].join(", ")}`
    );
  }

  if (!available.includes(example)) {
    return Result.err(
      `Unknown example '${example}' for preset '${preset}'. ` +
        `Available examples: ${available.join(", ")}`
    );
  }

  return Result.ok(`_examples/${preset}-${example}`);
}

/** Whether the project is a standalone package or a workspace with nested packages. */
export type InitStructure = "single" | "workspace";

/** Fully resolved inputs for the init execution pipeline, after interactive/non-interactive resolution. */
export interface ResolvedInitExecutionInput {
  readonly binName?: string | undefined;
  readonly blocksOverride?: readonly string[];
  /** Example overlay name (e.g., "todo" for cli, "files" for mcp). */
  readonly example?: string | undefined;
  /** Resolved example overlay directory name (e.g., "_examples/cli-todo"). Set by pipeline after validation. */
  readonly exampleOverlayDir?: string | undefined;
  readonly includeTooling: boolean;
  readonly local: boolean;
  readonly packageName: string;
  readonly preset: InitPresetId;
  readonly rootDir: string;
  readonly structure: InitStructure;
  readonly workspaceName?: string | undefined;
}

/** Behavioral flags controlling how the init pipeline executes (dry-run, force, skip steps). */
export interface InitExecutionOptions {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly installTimeout: number;
  readonly skipCommit: boolean;
  readonly skipGit: boolean;
  readonly skipInstall: boolean;
}

/** Output of a successful init pipeline run, including scaffold results and post-scaffold status. */
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
      ...(input.exampleOverlayDir
        ? ([
            {
              type: "copy-example-overlay",
              preset: input.exampleOverlayDir,
              targetDir: projectDir,
            },
          ] as const)
        : []),
      { type: "inject-shared-config" },
      ...(input.local
        ? ([{ type: "rewrite-local-dependencies", mode: "workspace" }] as const)
        : []),
      ...(blocks.length > 0 ? ([{ type: "add-blocks", blocks }] as const) : []),
    ],
  };
}

/**
 * Runs the full init pipeline: validates inputs, scaffolds the project structure,
 * executes the preset plan, and performs post-scaffold steps (install, git init).
 * @param input - Resolved user inputs (preset, structure, package name, etc.)
 * @param target - Target definition from the preset registry
 * @param options - Execution flags (dry-run, force, skip steps)
 * @returns The init result on success, or an error message string on failure
 */
export async function executeInitPipeline(
  input: ResolvedInitExecutionInput,
  target: TargetDefinition,
  options: InitExecutionOptions
): Promise<Result<InitExecutionResult, string>> {
  // Validate --example flag if provided
  let resolvedInput = input;
  if (input.example) {
    const exampleResult = validateExample(input.preset, input.example);
    if (exampleResult.isErr()) {
      return Result.err(exampleResult.error);
    }
    resolvedInput = { ...input, exampleOverlayDir: exampleResult.value };
  }

  const projectName = deriveProjectName(resolvedInput.packageName);
  if (resolvedInput.structure === "workspace") {
    const invalidProjectName = validateProjectDirectoryName(projectName);
    if (invalidProjectName) {
      return Result.err(
        `Invalid workspace project name '${projectName}': ${invalidProjectName}`
      );
    }
  }

  const collector = options.dryRun ? new OperationCollector() : undefined;

  const projectBaseDir = resolve(resolvedInput.rootDir, target.placement);
  const resolvedProjectDir = resolve(projectBaseDir, projectName);
  if (
    resolvedInput.structure === "workspace" &&
    !isPathWithin(projectBaseDir, resolvedProjectDir)
  ) {
    return Result.err(
      `Invalid workspace project name '${projectName}': path escapes '${projectBaseDir}'`
    );
  }

  const projectDir =
    resolvedInput.structure === "workspace"
      ? resolvedProjectDir
      : resolvedInput.rootDir;

  if (resolvedInput.structure === "single") {
    if (
      existsSync(join(resolvedInput.rootDir, "package.json")) &&
      !options.force
    ) {
      return Result.err(
        `Directory '${resolvedInput.rootDir}' already has a package.json. Use --force to overwrite, or use 'outfitter add' for existing projects.`
      );
    }
  } else {
    const workspaceName =
      resolvedInput.workspaceName ?? basename(resolvedInput.rootDir);
    const workspacePackageJsonPath = join(
      resolvedInput.rootDir,
      "package.json"
    );
    if (options.dryRun) {
      if (existsSync(workspacePackageJsonPath) && !options.force) {
        return Result.err(
          `Directory '${resolvedInput.rootDir}' already has a package.json. Use --force to overwrite.`
        );
      }

      collector?.add({
        type: "dir-create",
        path: join(resolvedInput.rootDir, "apps"),
      });
      collector?.add({
        type: "dir-create",
        path: join(resolvedInput.rootDir, "packages"),
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

      const readmePath = join(resolvedInput.rootDir, "README.md");
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

      const gitignorePath = join(resolvedInput.rootDir, ".gitignore");
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
        resolvedInput.rootDir,
        workspaceName,
        options.force
      );
      if (workspaceResult.isErr()) {
        return Result.err(workspaceResult.error.message);
      }
    }
  }

  const resolvedBinName =
    resolvedInput.binName ??
    deriveBinName(deriveProjectName(resolvedInput.packageName));

  const plan = buildInitPlan(
    target,
    resolvedInput,
    projectDir,
    resolvedBinName
  );

  const executeResult = await executePlan(plan, {
    force: options.force,
    ...(collector ? { collector } : {}),
  });

  if (executeResult.isErr()) {
    return Result.err(toExecutionErrorMessage(executeResult.error));
  }

  const postScaffoldResult = await runPostScaffold(
    {
      rootDir: resolvedInput.rootDir,
      projectDir,
      origin: "init",
      target: resolvedInput.preset,
      structure: resolvedInput.structure,
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
    structure: resolvedInput.structure,
    rootDir: resolvedInput.rootDir,
    projectDir,
    preset: resolvedInput.preset,
    packageName: resolvedInput.packageName,
    blocksAdded: executeResult.value.blocksAdded,
    postScaffold: postScaffoldResult.value,
    ...(collector ? { dryRunPlan: collector.toJSON() } : {}),
  });
}
