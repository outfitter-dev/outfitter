/**
 * `outfitter init` - Scaffolds a new Outfitter project.
 *
 * Supports both interactive and non-interactive flows, plus workspace-aware
 * scaffolding and post-scaffold automation.
 *
 * @packageDocumentation
 */

import { basename, resolve } from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  text,
} from "@clack/prompts";
import { exitWithError } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";

import {
  deriveBinName,
  deriveProjectName,
  resolvePackageName,
  sanitizePackageName,
  validatePackageName,
} from "../engine/index.js";
import type { PostScaffoldResult } from "../engine/post-scaffold.js";
import {
  getInitTarget,
  INIT_TARGET_IDS,
  TARGET_REGISTRY,
} from "../targets/index.js";
import {
  executeInitPipeline,
  type InitStructure,
  type ResolvedInitExecutionInput,
} from "./init-execution.js";
import {
  isBinaryPreset,
  parseBlocks,
  resolvePresetFromFlags,
  type InitPresetId,
} from "./init-option-resolution.js";
import { printInitResults } from "./init-output.js";

// =============================================================================
// Types
// =============================================================================

export type { InitStructure } from "./init-execution.js";
export type { InitPresetId } from "./init-option-resolution.js";
export { printInitResults };

/**
 * Options for the init command.
 */
export interface InitOptions {
  readonly bin?: string | undefined;
  readonly dryRun?: boolean | undefined;
  readonly force: boolean;
  readonly installTimeout?: number | undefined;
  readonly local?: boolean | undefined;
  readonly name: string | undefined;
  readonly noTooling?: boolean | undefined;
  readonly preset?: InitPresetId | undefined;
  readonly skipCommit?: boolean | undefined;
  readonly skipGit?: boolean | undefined;
  readonly skipInstall?: boolean | undefined;
  readonly structure?: InitStructure | undefined;
  readonly targetDir: string;
  readonly with?: string | undefined;
  readonly workspaceName?: string | undefined;
  readonly yes?: boolean | undefined;
}

/**
 * Result of running init.
 */
export interface InitResult {
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

type ResolvedInitInput = ResolvedInitExecutionInput;

/**
 * Error returned when initialization fails.
 */
export class InitError extends Error {
  readonly _tag = "InitError" as const;

  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

// =============================================================================
// Input Resolution
// =============================================================================

async function resolveInitInput(
  options: InitOptions,
  presetOverride?: InitPresetId
): Promise<Result<ResolvedInitInput, InitError>> {
  const rootDir = resolve(options.targetDir);
  const defaultName = basename(rootDir);
  const defaultPackageName = sanitizePackageName(defaultName) || defaultName;
  const presetFromFlagsResult = resolvePresetFromFlags(
    options.preset as string | undefined,
    INIT_TARGET_IDS
  );
  if (presetFromFlagsResult.isErr()) {
    return Result.err(new InitError(presetFromFlagsResult.error));
  }
  const presetFromFlags = presetFromFlagsResult.value;

  // Non-interactive path for explicit --yes or non-TTY contexts.
  if (options.yes || !process.stdout.isTTY) {
    const packageNameRaw = resolvePackageName(rootDir, options.name).trim();
    const packageName =
      options.name === undefined
        ? sanitizePackageName(packageNameRaw)
        : packageNameRaw;
    if (packageName.length === 0) {
      return Result.err(new InitError("Project name must not be empty"));
    }
    const invalidPackageName = validatePackageName(packageName);
    if (invalidPackageName) {
      const suggested = sanitizePackageName(packageNameRaw);
      const suggestion =
        suggested.length > 0 && suggested !== packageNameRaw
          ? ` Try '${suggested}'.`
          : "";
      return Result.err(
        new InitError(
          `Invalid package name '${packageNameRaw}': ${invalidPackageName}.${suggestion}`
        )
      );
    }

    const preset = presetOverride ?? presetFromFlags ?? "minimal";
    const structure =
      preset === "full-stack" ? "single" : (options.structure ?? "single");
    const blocksOverride = parseBlocks(options.with);
    const workspaceName =
      structure === "workspace"
        ? (options.workspaceName ?? defaultPackageName).trim() ||
          defaultPackageName
        : undefined;
    if (workspaceName) {
      const invalidWorkspaceName = validatePackageName(workspaceName);
      if (invalidWorkspaceName) {
        return Result.err(
          new InitError(
            `Invalid workspace package name '${workspaceName}': ${invalidWorkspaceName}`
          )
        );
      }
    }

    return Result.ok({
      rootDir,
      packageName,
      preset,
      structure,
      includeTooling: !(options.noTooling ?? false),
      local: Boolean(options.local),
      ...(blocksOverride ? { blocksOverride } : {}),
      ...(workspaceName ? { workspaceName } : {}),
      ...(options.bin ? { binName: options.bin } : {}),
    });
  }

  intro("Outfitter init");

  const packageNameValue =
    options.name ??
    (await text({
      message: "Project package name",
      placeholder: defaultPackageName,
      initialValue: defaultPackageName,
      validate: (value) =>
        (value ?? "").trim().length === 0
          ? "Project name is required"
          : undefined,
    }));

  if (isCancel(packageNameValue)) {
    cancel("Init cancelled.");
    return Result.err(new InitError("Init cancelled"));
  }

  const presetValue =
    presetOverride ??
    presetFromFlags ??
    (await select<InitPresetId>({
      message: "Select a preset",
      options: INIT_TARGET_IDS.map((id) => {
        const target = TARGET_REGISTRY.get(id);
        return {
          value: id as InitPresetId,
          label: id,
          hint: target?.description ?? "",
        };
      }),
      initialValue: "minimal",
    }));

  if (isCancel(presetValue)) {
    cancel("Init cancelled.");
    return Result.err(new InitError("Init cancelled"));
  }

  const structureValue =
    presetValue === "full-stack"
      ? "single"
      : (options.structure ??
        (await select<InitStructure>({
          message: "Project structure",
          options: [
            {
              value: "single",
              label: "Single package",
              hint: "One package in the target directory",
            },
            {
              value: "workspace",
              label: "Workspace",
              hint: "Root workspace with project under apps/ or packages/",
            },
          ],
          initialValue: "single",
        })));

  if (isCancel(structureValue)) {
    cancel("Init cancelled.");
    return Result.err(new InitError("Init cancelled"));
  }

  let binName: string | undefined;
  if (isBinaryPreset(presetValue) && process.stdout.isTTY) {
    const defaultBin = deriveBinName(
      deriveProjectName(packageNameValue.trim())
    );
    const binValue =
      options.bin ??
      (await text({
        message: "Binary name",
        placeholder: defaultBin,
        initialValue: defaultBin,
      }));

    if (isCancel(binValue)) {
      cancel("Init cancelled.");
      return Result.err(new InitError("Init cancelled"));
    }

    binName = binValue.trim();
  }

  let includeTooling: boolean | symbol;
  if (options.noTooling !== undefined) {
    includeTooling = !options.noTooling;
  } else if (options.with !== undefined) {
    includeTooling = true;
  } else {
    includeTooling = await confirm({
      message: "Add default tooling blocks?",
      initialValue: true,
    });
  }

  if (isCancel(includeTooling)) {
    cancel("Init cancelled.");
    return Result.err(new InitError("Init cancelled"));
  }

  const localValue =
    options.local !== undefined
      ? options.local
      : await confirm({
          message: "Use workspace:* for @outfitter dependencies?",
          initialValue: false,
        });

  if (isCancel(localValue)) {
    cancel("Init cancelled.");
    return Result.err(new InitError("Init cancelled"));
  }

  let workspaceName: string | undefined;
  if (structureValue === "workspace") {
    const workspaceNameValue =
      options.workspaceName ??
      (await text({
        message: "Workspace package name",
        placeholder: defaultPackageName,
        initialValue: defaultPackageName,
        validate: (value) =>
          (value ?? "").trim().length === 0
            ? "Workspace name is required"
            : undefined,
      }));

    if (isCancel(workspaceNameValue)) {
      cancel("Init cancelled.");
      return Result.err(new InitError("Init cancelled"));
    }

    workspaceName = workspaceNameValue.trim();
  }

  outro("Scaffolding project...");

  const packageName = packageNameValue.trim();
  if (packageName.length === 0) {
    return Result.err(new InitError("Project name must not be empty"));
  }
  const invalidPackageName = validatePackageName(packageName);
  if (invalidPackageName) {
    const suggested = sanitizePackageName(packageName);
    const suggestion =
      suggested.length > 0 && suggested !== packageName
        ? ` Try '${suggested}'.`
        : "";
    return Result.err(
      new InitError(
        `Invalid package name '${packageName}': ${invalidPackageName}.${suggestion}`
      )
    );
  }

  if (workspaceName) {
    const invalidWorkspaceName = validatePackageName(workspaceName);
    if (invalidWorkspaceName) {
      return Result.err(
        new InitError(
          `Invalid workspace package name '${workspaceName}': ${invalidWorkspaceName}`
        )
      );
    }
  }

  const blocksOverride = parseBlocks(options.with);

  return Result.ok({
    rootDir,
    packageName,
    preset: presetValue,
    structure: structureValue,
    includeTooling,
    local: Boolean(localValue),
    ...(blocksOverride ? { blocksOverride } : {}),
    ...(workspaceName ? { workspaceName } : {}),
    ...(binName ? { binName } : {}),
  });
}

// =============================================================================
// Public API
// =============================================================================

export async function runInit(
  options: InitOptions,
  presetOverride?: InitPresetId
): Promise<Result<InitResult, InitError>> {
  const inputResult = await resolveInitInput(options, presetOverride);
  if (inputResult.isErr()) {
    return inputResult;
  }

  const input = inputResult.value;

  const targetResult = getInitTarget(input.preset);
  if (targetResult.isErr()) {
    return Result.err(new InitError(targetResult.error.message));
  }
  const executeResult = await executeInitPipeline(input, targetResult.value, {
    dryRun: Boolean(options.dryRun),
    force: options.force,
    skipInstall: Boolean(options.skipInstall),
    skipGit: Boolean(options.skipGit),
    skipCommit: Boolean(options.skipCommit),
    installTimeout: options.installTimeout ?? 60_000,
  });

  if (executeResult.isErr()) {
    return Result.err(new InitError(executeResult.error));
  }

  return Result.ok(executeResult.value);
}

// =============================================================================
// Commander wiring
// =============================================================================

interface InitCommandFlags {
  bin?: string;
  dryRun?: boolean;
  force?: boolean;
  installTimeout?: number;
  json?: boolean;
  local?: boolean;
  name?: string;
  noTooling?: boolean;
  opts?: () => InitCommandFlags;
  preset?: InitPresetId;
  skipCommit?: boolean;
  skipGit?: boolean;
  skipInstall?: boolean;
  structure?: InitStructure;
  with?: string;
  workspace?: boolean;
  workspaceName?: string;
  yes?: boolean;
}

const resolveLocal = (flags: InitCommandFlags): boolean | undefined => {
  if (flags.local === true || flags.workspace === true) {
    return true;
  }
  return undefined;
};

const resolveOutputMode = (flags: InitCommandFlags): OutputMode | undefined => {
  if (flags.json) {
    return "json";
  }
  return undefined;
};

const withCommonOptions = (command: Command): Command =>
  command
    .option("-n, --name <name>", "Package name (defaults to directory name)")
    .option("-b, --bin <name>", "Binary name (defaults to project name)")
    .option(
      "-p, --preset <preset>",
      "Preset to use (minimal|cli|mcp|daemon|library|full-stack)"
    )
    .option("-s, --structure <mode>", "Project structure (single|workspace)")
    .option("--workspace-name <name>", "Workspace root package name")
    .option("-f, --force", "Overwrite existing files", false)
    .option("--local", "Use workspace:* for @outfitter dependencies")
    .option("--workspace", "Alias for --local")
    .option("--with <blocks>", "Comma-separated tooling blocks to add")
    .option("--no-tooling", "Skip default tooling blocks")
    .option("-y, --yes", "Skip prompts and use defaults", false)
    .option("--dry-run", "Preview changes without writing files", false)
    .option("--skip-install", "Skip bun install", false)
    .option("--skip-git", "Skip git init and initial commit", false)
    .option("--skip-commit", "Skip initial commit only", false)
    .option("--install-timeout <ms>", "bun install timeout in ms");

/**
 * @deprecated Use action-registry CLI wiring via `buildCliCommands(outfitterActions, ...)`.
 */
export function initCommand(program: Command): void {
  const init = program
    .command("init")
    .description("Create a new Outfitter project");

  const resolveFlags = (
    flags: InitCommandFlags,
    command?: Command
  ): InitCommandFlags => {
    if (command) {
      return command.optsWithGlobals<InitCommandFlags>();
    }
    return typeof flags.opts === "function" ? flags.opts() : flags;
  };

  withCommonOptions(init.argument("[directory]")).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        bin: resolvedFlags.bin,
        preset: resolvedFlags.preset,
        structure: resolvedFlags.structure,
        workspaceName: resolvedFlags.workspaceName,
        local: resolveLocal(resolvedFlags),
        force: resolvedFlags.force ?? false,
        with: resolvedFlags.with,
        noTooling: resolvedFlags.noTooling,
        yes: resolvedFlags.yes,
        dryRun: Boolean(resolvedFlags.dryRun),
        skipInstall: Boolean(resolvedFlags.skipInstall),
        skipGit: Boolean(resolvedFlags.skipGit),
        skipCommit: Boolean(resolvedFlags.skipCommit),
        ...(resolvedFlags.installTimeout !== undefined
          ? { installTimeout: resolvedFlags.installTimeout }
          : {}),
      });

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );

  withCommonOptions(
    init.command("cli [directory]").description("Create a new CLI project")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit(
        {
          targetDir,
          name: resolvedFlags.name,
          bin: resolvedFlags.bin,
          structure: resolvedFlags.structure,
          workspaceName: resolvedFlags.workspaceName,
          local: resolveLocal(resolvedFlags),
          force: resolvedFlags.force ?? false,
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          yes: resolvedFlags.yes,
          dryRun: Boolean(resolvedFlags.dryRun),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          skipGit: Boolean(resolvedFlags.skipGit),
          skipCommit: Boolean(resolvedFlags.skipCommit),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
            : {}),
        },
        "cli"
      );

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );

  withCommonOptions(
    init.command("mcp [directory]").description("Create a new MCP server")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit(
        {
          targetDir,
          name: resolvedFlags.name,
          bin: resolvedFlags.bin,
          structure: resolvedFlags.structure,
          workspaceName: resolvedFlags.workspaceName,
          local: resolveLocal(resolvedFlags),
          force: resolvedFlags.force ?? false,
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          yes: resolvedFlags.yes,
          dryRun: Boolean(resolvedFlags.dryRun),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          skipGit: Boolean(resolvedFlags.skipGit),
          skipCommit: Boolean(resolvedFlags.skipCommit),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
            : {}),
        },
        "mcp"
      );

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );

  withCommonOptions(
    init
      .command("daemon [directory]")
      .description("Create a new daemon project")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit(
        {
          targetDir,
          name: resolvedFlags.name,
          bin: resolvedFlags.bin,
          structure: resolvedFlags.structure,
          workspaceName: resolvedFlags.workspaceName,
          local: resolveLocal(resolvedFlags),
          force: resolvedFlags.force ?? false,
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          yes: resolvedFlags.yes,
          dryRun: Boolean(resolvedFlags.dryRun),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          skipGit: Boolean(resolvedFlags.skipGit),
          skipCommit: Boolean(resolvedFlags.skipCommit),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
            : {}),
        },
        "daemon"
      );

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );

  withCommonOptions(
    init.command("library [directory]").description("Create a new library")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit(
        {
          targetDir,
          name: resolvedFlags.name,
          bin: resolvedFlags.bin,
          structure: resolvedFlags.structure,
          workspaceName: resolvedFlags.workspaceName,
          local: resolveLocal(resolvedFlags),
          force: resolvedFlags.force ?? false,
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          yes: resolvedFlags.yes,
          dryRun: Boolean(resolvedFlags.dryRun),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          skipGit: Boolean(resolvedFlags.skipGit),
          skipCommit: Boolean(resolvedFlags.skipCommit),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
            : {}),
        },
        "library"
      );

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );

  withCommonOptions(
    init
      .command("full-stack [directory]")
      .description("Create a full-stack workspace")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const mode = resolveOutputMode(resolvedFlags);
      const outputOptions = mode ? { mode } : undefined;

      const result = await runInit(
        {
          targetDir,
          name: resolvedFlags.name,
          bin: resolvedFlags.bin,
          structure: resolvedFlags.structure,
          workspaceName: resolvedFlags.workspaceName,
          local: resolveLocal(resolvedFlags),
          force: resolvedFlags.force ?? false,
          with: resolvedFlags.with,
          noTooling: resolvedFlags.noTooling,
          yes: resolvedFlags.yes,
          dryRun: Boolean(resolvedFlags.dryRun),
          skipInstall: Boolean(resolvedFlags.skipInstall),
          skipGit: Boolean(resolvedFlags.skipGit),
          skipCommit: Boolean(resolvedFlags.skipCommit),
          ...(resolvedFlags.installTimeout !== undefined
            ? { installTimeout: resolvedFlags.installTimeout }
            : {}),
        },
        "full-stack"
      );

      if (result.isErr()) {
        exitWithError(result.error, outputOptions);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );
}
