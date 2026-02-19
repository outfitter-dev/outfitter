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
import { dirname, join } from "node:path";
import {
  type DocsCommonCliOptions,
  type DocsExportCliOptions,
  resolveDocsCliOptions,
  withDocsCommonOptions,
  withDocsExportOptions,
} from "@outfitter/docs";
import { Command } from "commander";
import {
  type ExecuteCheckCommandOptions,
  type ExecuteExportCommandOptions,
  type ExecuteSyncCommandOptions,
  loadDocsModule,
} from "./docs-module-loader.js";

const require = createRequire(import.meta.url);

export type RepoCheckSubject =
  | "docs"
  | "exports"
  | "readme"
  | "registry"
  | "changeset"
  | "tree"
  | "boundary-invocations";

export interface RepoCommandIo {
  readonly out?: (line: string) => void;
  readonly err?: (line: string) => void;
}

export interface RepoToolingInvocation {
  readonly command:
    | "check-exports"
    | "check-readme-imports"
    | "check-bunup-registry"
    | "check-changeset"
    | "check-clean-tree"
    | "check-boundary-invocations";
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface CreateRepoCommandOptions {
  readonly commandName?: string;
  readonly io?: RepoCommandIo;
  readonly runDocsCheck?: (
    options: ExecuteCheckCommandOptions,
    io: Required<RepoCommandIo>
  ) => Promise<number>;
  readonly runDocsSync?: (
    options: ExecuteSyncCommandOptions,
    io: Required<RepoCommandIo>
  ) => Promise<number>;
  readonly runDocsExport?: (
    options: ExecuteExportCommandOptions,
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
    .description("Assemble package docs into docs/packages");

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
  command
    .command("exports")
    .description("Validate package.json exports match source entry points")
    .option("--json", "Output results as JSON")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { json?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.json) {
        args.push("--json");
      }

      const code = await runToolingCommand({
        command: "check-exports",
        args,
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
    });

  command
    .command("readme")
    .description("Validate README import examples match package exports")
    .option("--json", "Output results as JSON")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { json?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.json) {
        args.push("--json");
      }

      const code = await runToolingCommand({
        command: "check-readme-imports",
        args,
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
    });

  command
    .command("registry")
    .description(
      "Validate packages with bunup --filter are registered in bunup.config.ts"
    )
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { cwd?: string }) => {
      const code = await runToolingCommand({
        command: "check-bunup-registry",
        args: [],
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
    });

  command
    .command("changeset")
    .description("Validate PRs touching package source include a changeset")
    .option("-s, --skip", "Skip changeset check")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { skip?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.skip) {
        args.push("--skip");
      }

      const code = await runToolingCommand({
        command: "check-changeset",
        args,
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
    });

  command
    .command("tree")
    .description(
      "Assert working tree is clean (no modified or untracked files)"
    )
    .option("--paths <paths...>", "Limit check to specific paths")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { paths?: string[]; cwd?: string }) => {
      const args: string[] = [];
      if (Array.isArray(cmdOptions.paths) && cmdOptions.paths.length > 0) {
        args.push("--paths", ...cmdOptions.paths);
      }

      const code = await runToolingCommand({
        command: "check-clean-tree",
        args,
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
    });

  command
    .command("boundary-invocations")
    .description(
      "Validate root/app scripts do not execute packages/*/src entrypoints directly"
    )
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { cwd?: string }) => {
      const code = await runToolingCommand({
        command: "check-boundary-invocations",
        args: [],
        cwd: resolveDocsCliOptions(cmdOptions).cwd ?? process.cwd(),
      });
      applyExitCode(code);
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
