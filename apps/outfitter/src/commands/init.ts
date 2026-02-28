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
import { resolveOutputMode as resolveOutputModeFromFlags } from "@outfitter/cli/query";
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
 * Options for the init command, corresponding to CLI flags and positional arguments.
 */
export interface InitOptions {
  /** Custom binary name for CLI/daemon presets. */
  readonly bin?: string | undefined;
  /** Preview changes without writing to disk. */
  readonly dryRun?: boolean | undefined;
  /** Example name to overlay pattern-rich scaffold files (e.g., "todo" for cli, "files" for mcp). */
  readonly example?: string | undefined;
  /** Overwrite existing files without prompting. */
  readonly force: boolean;
  /** Timeout in milliseconds for `bun install`. */
  readonly installTimeout?: number | undefined;
  /** Use `workspace:*` protocol for `@outfitter` dependencies. */
  readonly local?: boolean | undefined;
  /** Package name override (defaults to directory name). */
  readonly name: string | undefined;
  /** Skip adding default tooling blocks. */
  readonly noTooling?: boolean | undefined;
  /** Preset to scaffold from. */
  readonly preset?: InitPresetId | undefined;
  /** Skip the initial git commit after scaffolding. */
  readonly skipCommit?: boolean | undefined;
  /** Skip git init and initial commit entirely. */
  readonly skipGit?: boolean | undefined;
  /** Skip running `bun install` after scaffolding. */
  readonly skipInstall?: boolean | undefined;
  /** Whether to create a single package or a workspace. */
  readonly structure?: InitStructure | undefined;
  /** Absolute or relative path to the target directory. */
  readonly targetDir: string;
  /** Comma-separated tooling block names to include. */
  readonly with?: string | undefined;
  /** Package name for the workspace root (workspace structure only). */
  readonly workspaceName?: string | undefined;
  /** Skip interactive prompts and use defaults. */
  readonly yes?: boolean | undefined;
}

/**
 * Result of a successful `outfitter init` run.
 */
export interface InitResult {
  /** Tooling blocks that were added, if any. */
  readonly blocksAdded?: AddBlockResult | undefined;
  /** Present only for dry-run invocations; contains the planned operations and summary counts. */
  readonly dryRunPlan?:
    | {
        readonly operations: readonly unknown[];
        readonly summary: Record<string, number>;
      }
    | undefined;
  /** The resolved npm package name for the scaffolded project. */
  readonly packageName: string;
  /** Results from post-scaffold steps (install, git init, next-step hints). */
  readonly postScaffold: PostScaffoldResult;
  /** The preset that was used. */
  readonly preset: InitPresetId;
  /** Absolute path to the scaffolded project directory. */
  readonly projectDir: string;
  /** Absolute path to the workspace or project root. */
  readonly rootDir: string;
  /** Whether a single package or workspace was created. */
  readonly structure: InitStructure;
}

type ResolvedInitInput = ResolvedInitExecutionInput;

/**
 * Error returned when initialization fails.
 */
export class InitError extends Error {
  readonly _tag = "InitError" as const;

  /** @param message - Human-readable description of the init failure. */
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
      ...(options.example ? { example: options.example } : {}),
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
    ...(options.example ? { example: options.example } : {}),
  });
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the full init flow: resolves user input (interactive or non-interactive),
 * looks up the target preset, and delegates to the execution pipeline.
 * @param options - Init options from CLI flags or programmatic callers
 * @param presetOverride - Forces a specific preset, bypassing flag resolution and prompts
 */
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
  example?: string;
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
  const { mode } = resolveOutputModeFromFlags(
    flags as unknown as Record<string, unknown>
  );
  return mode === "human" ? undefined : mode;
};

const withCommonOptions = (command: Command): Command =>
  command
    .option("-n, --name <name>", "Package name (defaults to directory name)")
    .option("-b, --bin <name>", "Binary name (defaults to project name)")
    .option(
      "-e, --example <name>",
      "Scaffold with a pattern-rich example (cli: todo; mcp: files)"
    )
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
 * Registers the `init` command and its preset subcommands on a Commander program.
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
        example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
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
          example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
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
          example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
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
          example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
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
          example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
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
          example: resolvedFlags.example,
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
        exitWithError(result.error, mode);
        return;
      }

      await printInitResults(result.value, outputOptions);
    }
  );
}
