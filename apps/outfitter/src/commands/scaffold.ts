/**
 * `outfitter scaffold` - Add a capability to an existing project.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { exitWithError } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";

import { OperationCollector } from "../engine/collector.js";
import {
  deriveProjectName,
  executePlan,
  isPathWithin,
} from "../engine/index.js";
import type { PostScaffoldResult } from "../engine/post-scaffold.js";
import { runPostScaffold } from "../engine/post-scaffold.js";
import { scaffoldWorkspaceRoot } from "../engine/workspace.js";
import { getScaffoldTarget } from "../targets/index.js";
import { printScaffoldResults } from "./scaffold-output.js";
import {
  buildScaffoldPlan,
  convertToWorkspace,
  detectProjectStructure,
  ensureWorkspacePattern,
  validateScaffoldTargetName,
} from "./scaffold-planning.js";

/** Options for the scaffold command, corresponding to CLI flags and positional arguments. */
export interface ScaffoldOptions {
  /** Working directory to scaffold in. */
  readonly cwd: string;
  /** Preview changes without writing to disk. */
  readonly dryRun: boolean;
  /** Overwrite existing files without prompting. */
  readonly force: boolean;
  /** Timeout in milliseconds for `bun install`. */
  readonly installTimeout?: number | undefined;
  /** Use `workspace:*` protocol for `@outfitter` dependencies. */
  readonly local?: boolean | undefined;
  /** Override the default target directory name. */
  readonly name?: string | undefined;
  /** Skip adding default tooling blocks. */
  readonly noTooling?: boolean | undefined;
  /** Skip running `bun install` after scaffolding. */
  readonly skipInstall: boolean;
  /** Target preset ID to scaffold (e.g. "cli", "mcp"). */
  readonly target: string;
  /** Comma-separated tooling block names to include. */
  readonly with?: string | undefined;
}

/** Result of a successful `outfitter scaffold` run. */
export interface ScaffoldCommandResult {
  /** Tooling blocks that were added, if any. */
  readonly blocksAdded?: AddBlockResult | undefined;
  /** Whether the project was converted from single-package to workspace. */
  readonly converted: boolean;
  /** Present only for dry-run invocations; contains the planned operations and summary counts. */
  readonly dryRunPlan?:
    | {
        readonly operations: readonly unknown[];
        readonly summary: Record<string, number>;
      }
    | undefined;
  /** Details of the existing package that was relocated during workspace conversion. */
  readonly movedExisting?:
    | {
        readonly from: string;
        readonly to: string;
        readonly name: string;
      }
    | undefined;
  /** Results from post-scaffold steps (install, next-step hints). */
  readonly postScaffold: PostScaffoldResult;
  /** Absolute path to the workspace root. */
  readonly rootDir: string;
  /** The target preset ID that was scaffolded. */
  readonly target: string;
  /** Absolute path to the scaffolded target directory. */
  readonly targetDir: string;
  /** Whether a new workspace pattern was added to the root package.json. */
  readonly workspacePatternsUpdated: boolean;
}

/** Error returned when scaffolding fails. */
export class ScaffoldCommandError extends Error {
  readonly _tag = "ScaffoldCommandError" as const;

  /** @param message - Human-readable description of the scaffold failure. */
  constructor(message: string) {
    super(message);
    this.name = "ScaffoldCommandError";
  }
}

export { printScaffoldResults };

/**
 * Runs the full scaffold flow: detects project structure, converts to workspace
 * if needed, executes the preset plan, and performs post-scaffold steps.
 */
export async function runScaffold(
  options: ScaffoldOptions
): Promise<Result<ScaffoldCommandResult, ScaffoldCommandError>> {
  const targetResult = getScaffoldTarget(options.target);
  if (targetResult.isErr()) {
    return Result.err(new ScaffoldCommandError(targetResult.error.message));
  }
  const target = targetResult.value;

  const targetName = deriveProjectName(options.name ?? target.id);
  const targetNameValidation = validateScaffoldTargetName(targetName);
  if (targetNameValidation.isErr()) {
    return Result.err(new ScaffoldCommandError(targetNameValidation.error));
  }

  const dryRun = options.dryRun;
  const collector = dryRun ? new OperationCollector() : undefined;

  const structureResult = detectProjectStructure(options.cwd);
  if (structureResult.isErr()) {
    return Result.err(new ScaffoldCommandError(structureResult.error));
  }

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
      return Result.err(new ScaffoldCommandError(patternResult.error));
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
      return Result.err(new ScaffoldCommandError(conversionResult.error));
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

  const targetBaseDir = resolve(rootDir, target.placement);
  const targetDir = resolve(targetBaseDir, targetName);
  if (!isPathWithin(targetBaseDir, targetDir)) {
    return Result.err(
      new ScaffoldCommandError(
        `Invalid target name '${targetName}': path escapes '${targetBaseDir}'`
      )
    );
  }

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

/**
 * Registers the `scaffold` command on a Commander program.
 * @deprecated Use action-registry CLI wiring via `buildCliCommands(outfitterActions, ...)`.
 */
export function scaffoldCommand(program: Command): void {
  interface ScaffoldCommandFlags {
    dryRun?: boolean;
    force?: boolean;
    installTimeout?: number;
    json?: boolean;
    local?: boolean;
    noTooling?: boolean;
    skipInstall?: boolean;
    with?: string;
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
    .action(
      async (
        target: string,
        name: string | undefined,
        _flags: ScaffoldCommandFlags,
        command: Command
      ) => {
        const resolvedFlags = command.optsWithGlobals<ScaffoldCommandFlags>();
        const mode: OutputMode | undefined = resolvedFlags.json
          ? "json"
          : undefined;
        const outputOptions = mode ? { mode } : undefined;
        const result = await runScaffold({
          target,
          name,
          force: Boolean(resolvedFlags.force),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          dryRun: Boolean(resolvedFlags.dryRun),
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          local: resolvedFlags.local,
          cwd: process.cwd(),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
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
