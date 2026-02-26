/**
 * `outfitter repo` command surface for repository maintenance workflows.
 *
 * Provides a canonical namespace for docs maintenance and internal checks:
 * - `outfitter repo sync docs`
 * - `outfitter repo check <subject>`
 * - `outfitter repo export docs`
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import {
  booleanFlagPreset,
  composePresets,
  cwdPreset,
  stringListFlagPreset,
} from "@outfitter/cli/flags";
import { Command } from "commander";

import {
  type ExecuteCheckCommandOptions,
  type ExecuteExportCommandOptions,
  type ExecuteSyncCommandOptions,
  loadDocsModule,
} from "./docs-module-loader.js";

const require = createRequire(import.meta.url);

type DocsMdxMode = "strict" | "lossy";

interface DocsCommonCliOptions {
  readonly cwd?: string;
  readonly mdxMode?: DocsMdxMode;
  readonly outputDir?: string;
  readonly packagesDir?: string;
}

interface DocsExportCliOptions extends DocsCommonCliOptions {
  readonly llmsFile?: string;
  readonly llmsFullFile?: string;
  readonly target?: string;
}

export const DOCS_COMMON_OPTION_FLAGS = [
  "--cwd <path>",
  "--packages-dir <path>",
  "--output-dir <path>",
  "--mdx-mode <mode>",
] as const;

export const DOCS_EXPORT_OPTION_FLAGS = [
  "--llms-file <path>",
  "--llms-full-file <path>",
  "--target <target>",
] as const;

/**
 * Apply common docs CLI options to a commander subcommand.
 */
function withDocsCommonOptions<TCommand extends Command>(
  command: TCommand
): TCommand {
  return command
    .option(DOCS_COMMON_OPTION_FLAGS[0], "Workspace root to operate in")
    .option(
      DOCS_COMMON_OPTION_FLAGS[1],
      "Packages directory relative to workspace"
    )
    .option(
      DOCS_COMMON_OPTION_FLAGS[2],
      "Output directory relative to workspace"
    )
    .option(DOCS_COMMON_OPTION_FLAGS[3], "MDX handling mode: strict or lossy");
}

/**
 * Apply docs export options (including common docs options) to a subcommand.
 */
function withDocsExportOptions<TCommand extends Command>(
  command: TCommand
): TCommand {
  return withDocsCommonOptions(command)
    .option(
      DOCS_EXPORT_OPTION_FLAGS[0],
      "llms.txt output path relative to workspace"
    )
    .option(
      DOCS_EXPORT_OPTION_FLAGS[1],
      "llms-full.txt output path relative to workspace"
    )
    .option(
      DOCS_EXPORT_OPTION_FLAGS[2],
      "Export target: packages, llms, llms-full, all",
      "all"
    );
}

/**
 * Resolve `cwd` options relative to the current process for CLI parity.
 */
function resolveDocsCliOptions<TOptions extends { cwd?: string }>(
  options: TOptions
): TOptions {
  if (typeof options.cwd !== "string" || options.cwd.length === 0) {
    return options;
  }

  return {
    ...options,
    cwd: resolve(process.cwd(), options.cwd),
  };
}

export type RepoCheckSubject =
  | "docs"
  | "exports"
  | "readme"
  | "registry"
  | "changeset"
  | "tree"
  | "boundary-invocations";

export interface RepoCommandIo {
  readonly err?: (line: string) => void;
  readonly out?: (line: string) => void;
}

export interface RepoToolingInvocation {
  readonly args: readonly string[];
  readonly command:
    | "check-exports"
    | "check-readme-imports"
    | "check-bunup-registry"
    | "check-changeset"
    | "check-clean-tree"
    | "check-boundary-invocations"
    | "check-markdown-links";
  readonly cwd: string;
}

export interface CreateRepoCommandOptions {
  readonly commandName?: string;
  readonly io?: RepoCommandIo;
  readonly runDocsCheck?: (
    options: ExecuteCheckCommandOptions,
    io: Required<RepoCommandIo>
  ) => Promise<number>;
  readonly runDocsExport?: (
    options: ExecuteExportCommandOptions,
    io: Required<RepoCommandIo>
  ) => Promise<number>;
  readonly runDocsSync?: (
    options: ExecuteSyncCommandOptions,
    io: Required<RepoCommandIo>
  ) => Promise<number>;
  readonly runToolingCommand?: (
    input: RepoToolingInvocation
  ) => Promise<number>;
}

function getIo(
  options: CreateRepoCommandOptions | undefined
): Required<RepoCommandIo> {
  return {
    out:
      options?.io?.out ?? ((line: string) => process.stdout.write(`${line}\n`)),
    err:
      options?.io?.err ?? ((line: string) => process.stderr.write(`${line}\n`)),
  };
}

function resolveToolingCliEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/tooling/package.json");
  const packageRoot = dirname(packageJsonPath);
  // In monorepo dev, prefer source so new commands are immediately available.
  const srcEntrypoint = join(packageRoot, "src", "cli", "index.ts");
  if (existsSync(srcEntrypoint)) {
    return srcEntrypoint;
  }

  const distEntrypoint = join(packageRoot, "dist", "cli", "index.js");
  if (existsSync(distEntrypoint)) {
    return distEntrypoint;
  }

  throw new Error(
    "Unable to resolve @outfitter/tooling CLI entrypoint (expected dist/cli/index.js or src/cli/index.ts)."
  );
}

async function runDocsCheckDefault(
  options: ExecuteCheckCommandOptions,
  io: Required<RepoCommandIo>
): Promise<number> {
  const docsModule = await loadDocsModule();
  return await docsModule.executeCheckCommand(options, io);
}

async function runDocsSyncDefault(
  options: ExecuteSyncCommandOptions,
  io: Required<RepoCommandIo>
): Promise<number> {
  const docsModule = await loadDocsModule();
  return await docsModule.executeSyncCommand(options, io);
}

async function runDocsExportDefault(
  options: ExecuteExportCommandOptions,
  io: Required<RepoCommandIo>
): Promise<number> {
  const docsModule = await loadDocsModule();
  return await docsModule.executeExportCommand(options, io);
}

async function runToolingCommandDefault(
  input: RepoToolingInvocation
): Promise<number> {
  const toolingCliEntrypoint = resolveToolingCliEntrypoint();
  const child = Bun.spawn(
    [process.execPath, toolingCliEntrypoint, input.command, ...input.args],
    {
      cwd: input.cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  return await child.exited;
}

function applyExitCode(code: number): void {
  if (code !== 0) {
    process.exitCode = code;
  }
}

function applyPresetOptions(
  command: Command,
  preset: {
    readonly options: readonly {
      readonly flags: string;
      readonly description: string;
      readonly defaultValue?: unknown;
    }[];
  }
): Command {
  for (const option of preset.options) {
    command.option(
      option.flags,
      option.description,
      option.defaultValue as string | boolean | string[] | undefined
    );
  }
  return command;
}

function addDocsCheckSubcommand(
  command: Command,
  options: {
    readonly io: Required<RepoCommandIo>;
    readonly runDocsCheck: (
      opts: ExecuteCheckCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
  }
): void {
  const docsCheckCommand = command
    .command("docs")
    .description("Check whether assembled package docs are in sync");

  withDocsCommonOptions(docsCheckCommand).action(
    async (cmdOptions: DocsCommonCliOptions) => {
      const code = await options.runDocsCheck(
        resolveDocsCliOptions(cmdOptions),
        options.io
      );
      applyExitCode(code);
    }
  );
}

function addDocsSyncSubcommand(
  command: Command,
  options: {
    readonly io: Required<RepoCommandIo>;
    readonly runDocsSync: (
      opts: ExecuteSyncCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
  }
): void {
  const docsSyncCommand = command
    .command("docs")
    .description("Assemble package docs mirrors locally");

  withDocsCommonOptions(docsSyncCommand).action(
    async (cmdOptions: DocsCommonCliOptions) => {
      const code = await options.runDocsSync(
        resolveDocsCliOptions(cmdOptions),
        options.io
      );
      applyExitCode(code);
    }
  );
}

function addDocsExportSubcommand(
  command: Command,
  options: {
    readonly io: Required<RepoCommandIo>;
    readonly runDocsExport: (
      opts: ExecuteExportCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
  }
): void {
  const docsExportCommand = command
    .command("docs")
    .description("Export docs artifacts for packages and LLM targets");

  withDocsExportOptions(docsExportCommand).action(
    async (cmdOptions: DocsExportCliOptions) => {
      const code = await options.runDocsExport(
        resolveDocsCliOptions(cmdOptions),
        options.io
      );
      applyExitCode(code);
    }
  );
}

function addToolingCheckSubcommands(
  command: Command,
  runToolingCommand: (input: RepoToolingInvocation) => Promise<number>
): void {
  const cwdFlag = cwdPreset();
  const jsonFlag = booleanFlagPreset({
    id: "repo-check-json",
    key: "json",
    flags: "--json",
    description: "Output results as JSON",
  });
  const skipFlag = booleanFlagPreset({
    id: "repo-check-skip",
    key: "skip",
    flags: "-s, --skip",
    description: "Skip changeset check",
  });
  const pathsFlag = stringListFlagPreset({
    id: "repo-check-paths",
    key: "paths",
    flags: "--paths <paths...>",
    description: "Limit check to specific paths",
  });

  const toolingWithCwd = composePresets(cwdFlag);
  const toolingWithJsonAndCwd = composePresets(jsonFlag, cwdFlag);
  const toolingWithSkipAndCwd = composePresets(skipFlag, cwdFlag);
  const toolingWithPathsAndCwd = composePresets(pathsFlag, cwdFlag);

  function registerToolingCheckSubcommand<
    TResolved extends Record<string, unknown>,
  >(config: {
    readonly name: string;
    readonly description: string;
    readonly toolingCommand: RepoToolingInvocation["command"];
    readonly preset: {
      readonly options: readonly {
        readonly flags: string;
        readonly description: string;
        readonly defaultValue?: unknown;
      }[];
      readonly resolve: (
        flags: Record<string, unknown>
      ) => TResolved & { cwd: string };
    };
    readonly buildArgs: (resolved: TResolved) => string[];
  }): void {
    const subcommand = command
      .command(config.name)
      .description(config.description);
    applyPresetOptions(subcommand, config.preset);

    subcommand.action(async (cmdOptions: Record<string, unknown>) => {
      const resolved = config.preset.resolve(cmdOptions);
      const cwd =
        resolveDocsCliOptions({ cwd: resolved.cwd }).cwd || process.cwd();

      const code = await runToolingCommand({
        command: config.toolingCommand,
        args: config.buildArgs(resolved),
        cwd,
      });
      applyExitCode(code);
    });
  }

  registerToolingCheckSubcommand({
    name: "exports",
    description: "Validate package.json exports match source entry points",
    toolingCommand: "check-exports",
    preset: toolingWithJsonAndCwd,
    buildArgs: (resolved) => (resolved["json"] ? ["--json"] : []),
  });

  registerToolingCheckSubcommand({
    name: "readme",
    description: "Validate README import examples match package exports",
    toolingCommand: "check-readme-imports",
    preset: toolingWithJsonAndCwd,
    buildArgs: (resolved) => (resolved["json"] ? ["--json"] : []),
  });

  registerToolingCheckSubcommand({
    name: "registry",
    description:
      "Validate packages with bunup --filter are registered in bunup.config.ts",
    toolingCommand: "check-bunup-registry",
    preset: toolingWithCwd,
    buildArgs: () => [],
  });

  registerToolingCheckSubcommand({
    name: "changeset",
    description: "Validate PRs touching package source include a changeset",
    toolingCommand: "check-changeset",
    preset: toolingWithSkipAndCwd,
    buildArgs: (resolved) => (resolved["skip"] ? ["--skip"] : []),
  });

  registerToolingCheckSubcommand({
    name: "tree",
    description:
      "Assert working tree is clean (no modified or untracked files)",
    toolingCommand: "check-clean-tree",
    preset: toolingWithPathsAndCwd,
    buildArgs: (resolved) =>
      Array.isArray(resolved["paths"]) && resolved["paths"].length > 0
        ? ["--paths", ...resolved["paths"]]
        : [],
  });

  registerToolingCheckSubcommand({
    name: "boundary-invocations",
    description:
      "Validate root/app scripts do not execute packages/*/src entrypoints directly",
    toolingCommand: "check-boundary-invocations",
    preset: toolingWithCwd,
    buildArgs: () => [],
  });

  registerToolingCheckSubcommand({
    name: "markdown-links",
    description:
      "Validate relative links in markdown files resolve to existing files",
    toolingCommand: "check-markdown-links",
    preset: toolingWithCwd,
    buildArgs: () => [],
  });
}

export function createRepoCommand(options?: CreateRepoCommandOptions): Command {
  const io = getIo(options);
  const runDocsCheck = options?.runDocsCheck ?? runDocsCheckDefault;
  const runDocsSync = options?.runDocsSync ?? runDocsSyncDefault;
  const runDocsExport = options?.runDocsExport ?? runDocsExportDefault;
  const runToolingCommand =
    options?.runToolingCommand ?? runToolingCommandDefault;

  const command = new Command(options?.commandName ?? "repo");
  command.description("Repository maintenance commands");

  const checkCommand = command
    .command("check")
    .description("Run repository checks by subject");
  addDocsCheckSubcommand(checkCommand, { io, runDocsCheck });
  addToolingCheckSubcommands(checkCommand, runToolingCommand);

  const syncCommand = command
    .command("sync")
    .description("Synchronize repository artifacts by subject");
  addDocsSyncSubcommand(syncCommand, { io, runDocsSync });

  const exportCommand = command
    .command("export")
    .description("Export repository artifacts by subject");
  addDocsExportSubcommand(exportCommand, { io, runDocsExport });

  return command;
}

async function main(): Promise<void> {
  const command = createRepoCommand({ commandName: "repo" });
  await command.parseAsync(process.argv, { from: "node" });
}

if (import.meta.main) {
  void main();
}
