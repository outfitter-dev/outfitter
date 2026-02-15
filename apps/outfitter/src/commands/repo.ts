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
  type ExecuteCheckCommandOptions,
  type ExecuteExportCommandOptions,
  type ExecuteSyncCommandOptions,
  executeCheckCommand,
  executeExportCommand,
  executeSyncCommand,
} from "@outfitter/docs";
import { Command } from "commander";

const require = createRequire(import.meta.url);

export type RepoCheckSubject =
  | "docs"
  | "exports"
  | "readme-imports"
  | "bunup-registry"
  | "changeset"
  | "clean-tree"
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

function resolveCwdOption(inputCwd: string | undefined): string {
  if (typeof inputCwd !== "string" || inputCwd.length === 0) {
    return process.cwd();
  }
  return resolve(process.cwd(), inputCwd);
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
  command
    .command("docs")
    .description("Check whether assembled package docs are in sync")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .action(
      async (cmdOptions: {
        cwd?: string;
        mdxMode?: "strict" | "lossy";
        packagesDir?: string;
        outputDir?: string;
      }) => {
        const code = await options.runDocsCheck(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
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
  command
    .command("docs")
    .description("Assemble package docs into docs/packages")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .action(
      async (cmdOptions: {
        cwd?: string;
        mdxMode?: "strict" | "lossy";
        packagesDir?: string;
        outputDir?: string;
      }) => {
        const code = await options.runDocsSync(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
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
  command
    .command("docs")
    .description("Export docs artifacts for packages and LLM targets")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .option("--llms-file <path>", "llms.txt output path relative to workspace")
    .option(
      "--llms-full-file <path>",
      "llms-full.txt output path relative to workspace"
    )
    .option(
      "--target <target>",
      "Export target: packages, llms, llms-full, all",
      "all"
    )
    .action(
      async (cmdOptions: {
        cwd?: string;
        llmsFile?: string;
        llmsFullFile?: string;
        mdxMode?: "strict" | "lossy";
        outputDir?: string;
        packagesDir?: string;
        target?: string;
      }) => {
        const code = await options.runDocsExport(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
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
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("readme-imports")
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
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("bunup-registry")
    .description(
      "Validate packages with bunup --filter are registered in bunup.config.ts"
    )
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { cwd?: string }) => {
      const code = await runToolingCommand({
        command: "check-bunup-registry",
        args: [],
        cwd: resolveCwdOption(cmdOptions.cwd),
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
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("clean-tree")
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
        cwd: resolveCwdOption(cmdOptions.cwd),
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
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });
}

function addLegacyAliasCommands(
  command: Command,
  options: {
    readonly io: Required<RepoCommandIo>;
    readonly runDocsCheck: (
      opts: ExecuteCheckCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
    readonly runDocsSync: (
      opts: ExecuteSyncCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
    readonly runDocsExport: (
      opts: ExecuteExportCommandOptions,
      io: Required<RepoCommandIo>
    ) => Promise<number>;
    readonly runToolingCommand: (
      input: RepoToolingInvocation
    ) => Promise<number>;
  }
): void {
  command
    .command("docs-check")
    .description("Legacy alias for `outfitter repo check docs`")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .action(
      async (cmdOptions: {
        cwd?: string;
        mdxMode?: "strict" | "lossy";
        packagesDir?: string;
        outputDir?: string;
      }) => {
        const code = await options.runDocsCheck(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
          options.io
        );
        applyExitCode(code);
      }
    );

  command
    .command("docs-sync")
    .description("Legacy alias for `outfitter repo sync docs`")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .action(
      async (cmdOptions: {
        cwd?: string;
        mdxMode?: "strict" | "lossy";
        packagesDir?: string;
        outputDir?: string;
      }) => {
        const code = await options.runDocsSync(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
          options.io
        );
        applyExitCode(code);
      }
    );

  command
    .command("docs-export")
    .description("Legacy alias for `outfitter repo export docs`")
    .option("--cwd <path>", "Workspace root to operate in")
    .option("--packages-dir <path>", "Packages directory relative to workspace")
    .option("--output-dir <path>", "Output directory relative to workspace")
    .option("--mdx-mode <mode>", "MDX handling mode: strict or lossy")
    .option("--llms-file <path>", "llms.txt output path relative to workspace")
    .option(
      "--llms-full-file <path>",
      "llms-full.txt output path relative to workspace"
    )
    .option(
      "--target <target>",
      "Export target: packages, llms, llms-full, all",
      "all"
    )
    .action(
      async (cmdOptions: {
        cwd?: string;
        llmsFile?: string;
        llmsFullFile?: string;
        mdxMode?: "strict" | "lossy";
        outputDir?: string;
        packagesDir?: string;
        target?: string;
      }) => {
        const code = await options.runDocsExport(
          {
            ...cmdOptions,
            ...(cmdOptions.cwd
              ? { cwd: resolveCwdOption(cmdOptions.cwd) }
              : {}),
          },
          options.io
        );
        applyExitCode(code);
      }
    );

  command
    .command("check-exports")
    .description("Legacy alias for `outfitter repo check exports`")
    .option("--json", "Output results as JSON")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { json?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.json) {
        args.push("--json");
      }

      const code = await options.runToolingCommand({
        command: "check-exports",
        args,
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("check-readme-imports")
    .description("Legacy alias for `outfitter repo check readme-imports`")
    .option("--json", "Output results as JSON")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { json?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.json) {
        args.push("--json");
      }

      const code = await options.runToolingCommand({
        command: "check-readme-imports",
        args,
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("check-bunup-registry")
    .description("Legacy alias for `outfitter repo check bunup-registry`")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { cwd?: string }) => {
      const code = await options.runToolingCommand({
        command: "check-bunup-registry",
        args: [],
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("check-changeset")
    .description("Legacy alias for `outfitter repo check changeset`")
    .option("-s, --skip", "Skip changeset check")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { skip?: boolean; cwd?: string }) => {
      const args: string[] = [];
      if (cmdOptions.skip) {
        args.push("--skip");
      }

      const code = await options.runToolingCommand({
        command: "check-changeset",
        args,
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("check-clean-tree")
    .description("Legacy alias for `outfitter repo check clean-tree`")
    .option("--paths <paths...>", "Limit check to specific paths")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { paths?: string[]; cwd?: string }) => {
      const args: string[] = [];
      if (Array.isArray(cmdOptions.paths) && cmdOptions.paths.length > 0) {
        args.push("--paths", ...cmdOptions.paths);
      }

      const code = await options.runToolingCommand({
        command: "check-clean-tree",
        args,
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });

  command
    .command("check-boundary-invocations")
    .description("Legacy alias for `outfitter repo check boundary-invocations`")
    .option("--cwd <path>", "Workspace root to operate in")
    .action(async (cmdOptions: { cwd?: string }) => {
      const code = await options.runToolingCommand({
        command: "check-boundary-invocations",
        args: [],
        cwd: resolveCwdOption(cmdOptions.cwd),
      });
      applyExitCode(code);
    });
}

export function createRepoCommand(options?: CreateRepoCommandOptions): Command {
  const io = getIo(options);
  const runDocsCheck = options?.runDocsCheck ?? executeCheckCommand;
  const runDocsSync = options?.runDocsSync ?? executeSyncCommand;
  const runDocsExport = options?.runDocsExport ?? executeExportCommand;
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
  addLegacyAliasCommands(command, {
    io,
    runDocsCheck,
    runDocsSync,
    runDocsExport,
    runToolingCommand,
  });

  return command;
}

async function main(): Promise<void> {
  const command = createRepoCommand({ commandName: "repo" });
  await command.parseAsync(process.argv, { from: "node" });
}

if (import.meta.main) {
  void main();
}
