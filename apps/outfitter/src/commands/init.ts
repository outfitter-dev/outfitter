/**
 * `outfitter init` - Scaffolds a new Outfitter project.
 *
 * Supports both interactive and non-interactive flows, plus workspace-aware
 * scaffolding and post-scaffold automation.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  text,
} from "@clack/prompts";
import { exitWithError, output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";
import { OperationCollector } from "../engine/collector.js";
import {
  deriveBinName,
  deriveProjectName,
  executePlan,
  resolveAuthor,
  resolvePackageName,
  resolveYear,
  type ScaffoldPlan,
  scaffoldWorkspaceRoot,
} from "../engine/index.js";
import type { PostScaffoldResult } from "../engine/post-scaffold.js";
import { runPostScaffold } from "../engine/post-scaffold.js";
import { renderOperationPlan } from "../engine/render-plan.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import {
  getInitTarget,
  INIT_TARGET_IDS,
  TARGET_REGISTRY,
  type TargetDefinition,
  type TargetId,
} from "../targets/index.js";

// =============================================================================
// Types
// =============================================================================

export type InitStructure = "single" | "workspace";
export type InitPresetId = Extract<
  TargetId,
  "minimal" | "cli" | "mcp" | "daemon"
>;

/**
 * Options for the init command.
 */
export interface InitOptions {
  readonly targetDir: string;
  readonly name: string | undefined;
  readonly bin?: string | undefined;
  readonly preset?: InitPresetId | undefined;
  /** @deprecated Use `preset` instead. */
  readonly template?: string | undefined;
  readonly structure?: InitStructure | undefined;
  readonly workspaceName?: string | undefined;
  readonly local?: boolean | undefined;
  readonly force: boolean;
  readonly with?: string | undefined;
  readonly noTooling?: boolean | undefined;
  readonly yes?: boolean | undefined;
  readonly dryRun?: boolean | undefined;
  readonly skipInstall?: boolean | undefined;
  readonly skipGit?: boolean | undefined;
  readonly skipCommit?: boolean | undefined;
  readonly installTimeout?: number | undefined;
}

/**
 * Result of running init.
 */
export interface InitResult {
  readonly structure: InitStructure;
  readonly rootDir: string;
  readonly projectDir: string;
  readonly preset: InitPresetId;
  readonly packageName: string;
  readonly blocksAdded?: AddBlockResult | undefined;
  readonly postScaffold: PostScaffoldResult;
  readonly dryRunPlan?:
    | {
        readonly operations: readonly unknown[];
        readonly summary: Record<string, number>;
      }
    | undefined;
}

interface ResolvedInitInput {
  readonly rootDir: string;
  readonly packageName: string;
  readonly preset: InitPresetId;
  readonly structure: InitStructure;
  readonly workspaceName?: string | undefined;
  readonly includeTooling: boolean;
  readonly blocksOverride?: readonly string[];
  readonly local: boolean;
  readonly binName?: string | undefined;
}

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

function isBinaryPreset(preset: InitPresetId): boolean {
  return preset === "cli" || preset === "daemon";
}

function isValidInitPreset(value: string): value is InitPresetId {
  return (
    value === "minimal" ||
    value === "cli" ||
    value === "mcp" ||
    value === "daemon"
  );
}

function resolvePresetFromFlags(
  options: InitOptions
): Result<InitPresetId | undefined, InitError> {
  const presetFromFlag = options.preset as string | undefined;
  if (presetFromFlag) {
    if (!isValidInitPreset(presetFromFlag)) {
      return Result.err(
        new InitError(
          `Unknown preset '${presetFromFlag}'. Available presets: ${INIT_TARGET_IDS.join(", ")}`
        )
      );
    }
    return Result.ok(presetFromFlag);
  }

  if (options.template) {
    const mapped = options.template === "basic" ? "minimal" : options.template;
    process.stderr.write(
      "Warning: --template is deprecated and will be removed in the next major version.\n" +
        `  Use --preset instead: outfitter init --preset ${mapped}\n` +
        (options.template === "basic"
          ? '  Note: "basic" has been renamed to "minimal".\n'
          : "")
    );

    if (isValidInitPreset(mapped)) {
      return Result.ok(mapped);
    }

    return Result.err(
      new InitError(
        `Unknown template '${options.template}'. Available presets: ${INIT_TARGET_IDS.join(", ")}`
      )
    );
  }

  return Result.ok(undefined);
}

async function resolveInitInput(
  options: InitOptions,
  presetOverride?: InitPresetId
): Promise<Result<ResolvedInitInput, InitError>> {
  const rootDir = resolve(options.targetDir);
  const defaultName = basename(rootDir);
  const presetFromFlagsResult = resolvePresetFromFlags(options);
  if (presetFromFlagsResult.isErr()) {
    return presetFromFlagsResult;
  }
  const presetFromFlags = presetFromFlagsResult.value;

  // Non-interactive path for explicit --yes or non-TTY contexts.
  if (options.yes || !process.stdout.isTTY) {
    const packageName = resolvePackageName(rootDir, options.name).trim();
    if (packageName.length === 0) {
      return Result.err(new InitError("Project name must not be empty"));
    }

    const preset = presetOverride ?? presetFromFlags ?? "minimal";
    const structure = options.structure ?? "single";
    const blocksOverride = parseBlocks(options.with);
    const workspaceName =
      structure === "workspace"
        ? (options.workspaceName ?? defaultName).trim() || defaultName
        : undefined;

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
      placeholder: defaultName,
      initialValue: defaultName,
      validate: (value) =>
        value.trim().length === 0 ? "Project name is required" : undefined,
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
    options.structure ??
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
    }));

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
        placeholder: defaultName,
        initialValue: defaultName,
        validate: (value) =>
          value.trim().length === 0 ? "Workspace name is required" : undefined,
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

function toInitError(error: unknown): InitError {
  if (error instanceof InitError) {
    return error;
  }
  if (error instanceof Error) {
    return new InitError(error.message);
  }
  return new InitError("Unknown init error");
}

function buildInitPlan(
  target: TargetDefinition,
  input: ResolvedInitInput,
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
        type: "copy-template",
        template: target.templateDir,
        targetDir: projectDir,
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
  const target = targetResult.value;

  const dryRun = Boolean(options.dryRun);
  const collector = dryRun ? new OperationCollector() : undefined;

  const projectDir =
    input.structure === "workspace"
      ? join(
          input.rootDir,
          target.placement,
          deriveProjectName(input.packageName)
        )
      : input.rootDir;

  if (input.structure === "single") {
    if (existsSync(join(input.rootDir, "package.json")) && !options.force) {
      return Result.err(
        new InitError(
          `Directory '${input.rootDir}' already has a package.json. ` +
            `Use --force to overwrite, or use 'outfitter add' for existing projects.`
        )
      );
    }
  } else {
    const workspaceName = input.workspaceName ?? basename(input.rootDir);
    const workspacePackageJsonPath = join(input.rootDir, "package.json");
    if (dryRun) {
      if (existsSync(workspacePackageJsonPath) && !options.force) {
        return Result.err(
          new InitError(
            `Directory '${input.rootDir}' already has a package.json. Use --force to overwrite.`
          )
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
        return Result.err(new InitError(workspaceResult.error.message));
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
    return Result.err(toInitError(executeResult.error));
  }

  const postScaffoldResult = await runPostScaffold(
    {
      rootDir: input.rootDir,
      projectDir,
      origin: "init",
      target: input.preset,
      structure: input.structure,
      skipInstall: Boolean(options.skipInstall),
      skipGit: Boolean(options.skipGit),
      skipCommit: Boolean(options.skipCommit),
      dryRun,
      installTimeoutMs: options.installTimeout ?? 60_000,
    },
    collector
  );
  if (postScaffoldResult.isErr()) {
    return Result.err(new InitError("Post-scaffold step failed"));
  }

  const result: InitResult = {
    structure: input.structure,
    rootDir: input.rootDir,
    projectDir,
    preset: input.preset,
    packageName: input.packageName,
    blocksAdded: executeResult.value.blocksAdded,
    postScaffold: postScaffoldResult.value,
    ...(collector ? { dryRunPlan: collector.toJSON() } : {}),
  };

  return Result.ok(result);
}

export async function printInitResults(
  result: InitResult,
  options?: { mode?: OutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (result.dryRunPlan) {
    if (structuredMode) {
      await output(
        {
          rootDir: result.rootDir,
          projectDir: result.projectDir,
          structure: result.structure,
          preset: result.preset,
          packageName: result.packageName,
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
        structure: result.structure,
        rootDir: result.rootDir,
        projectDir: result.projectDir,
        preset: result.preset,
        packageName: result.packageName,
        blocksAdded: result.blocksAdded ?? null,
        postScaffold: result.postScaffold,
        nextSteps: result.postScaffold.nextSteps,
      },
      { mode: structuredMode }
    );
    return;
  }

  const lines: string[] = [
    `Project initialized successfully in ${result.rootDir}`,
    `Structure: ${result.structure}`,
    `Preset: ${result.preset}`,
  ];

  if (result.structure === "workspace") {
    lines.push(`Workspace project path: ${result.projectDir}`);
  }

  if (result.blocksAdded) {
    const { created, skipped, dependencies, devDependencies } =
      result.blocksAdded;

    if (created.length > 0) {
      lines.push("", `Added ${created.length} tooling file(s):`);
      for (const file of created) {
        lines.push(`  ✓ ${file}`);
      }
    }

    if (skipped.length > 0) {
      lines.push("", `Skipped ${skipped.length} existing file(s):`);
      for (const file of skipped) {
        lines.push(`  - ${file}`);
      }
    }

    const depCount =
      Object.keys(dependencies).length + Object.keys(devDependencies).length;
    if (depCount > 0) {
      lines.push("", `Added ${depCount} package(s) to package.json:`);
      for (const [name, version] of Object.entries(dependencies)) {
        lines.push(`  + ${name}@${version}`);
      }
      for (const [name, version] of Object.entries(devDependencies)) {
        lines.push(`  + ${name}@${version} (dev)`);
      }
    }
  }

  if (result.postScaffold.installResult === "failed") {
    lines.push(
      "",
      `Warning: bun install failed: ${result.postScaffold.installError ?? "unknown"}`
    );
  }
  if (result.postScaffold.gitInitResult === "failed") {
    lines.push(
      "",
      `Warning: git setup failed: ${result.postScaffold.gitError ?? "unknown"}`
    );
  }

  lines.push("", "Next steps:");
  for (const step of result.postScaffold.nextSteps) {
    lines.push(`  ${step}`);
  }

  await output(lines);
}

// =============================================================================
// Commander wiring
// =============================================================================

export function initCommand(program: Command): void {
  const init = program
    .command("init")
    .description("Create a new Outfitter project");

  interface InitCommandFlags {
    name?: string;
    bin?: string;
    preset?: InitPresetId;
    template?: string;
    structure?: InitStructure;
    workspaceName?: string;
    local?: boolean;
    workspace?: boolean;
    force?: boolean;
    with?: string;
    noTooling?: boolean;
    yes?: boolean;
    dryRun?: boolean;
    skipInstall?: boolean;
    skipGit?: boolean;
    skipCommit?: boolean;
    installTimeout?: number;
    json?: boolean;
    opts?: () => InitCommandFlags;
  }

  const resolveFlags = (
    flags: InitCommandFlags,
    command?: Command
  ): InitCommandFlags => {
    if (command) {
      return command.optsWithGlobals<InitCommandFlags>();
    }
    return typeof flags.opts === "function" ? flags.opts() : flags;
  };

  const resolveLocal = (flags: InitCommandFlags): boolean | undefined => {
    if (flags.local === true || flags.workspace === true) {
      return true;
    }
    return undefined;
  };

  const resolveOutputMode = (
    flags: InitCommandFlags
  ): OutputMode | undefined => {
    if (flags.json) {
      process.env["OUTFITTER_JSON"] = "1";
      return "json";
    }
    return undefined;
  };

  const withCommonOptions = (command: Command): Command =>
    command
      .option("-n, --name <name>", "Package name (defaults to directory name)")
      .option("-b, --bin <name>", "Binary name (defaults to project name)")
      .option("-p, --preset <preset>", "Preset to use (minimal|cli|mcp|daemon)")
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
      .option("--install-timeout <ms>", "bun install timeout in ms")
      .option("--json", "Output as JSON", false);

  withCommonOptions(
    init
      .argument("[directory]")
      .option("-t, --template <template>", "Template to use (deprecated)")
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

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        bin: resolvedFlags.bin,
        preset: resolvedFlags.preset,
        template: resolvedFlags.template,
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
}
