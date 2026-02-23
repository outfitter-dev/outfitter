import { Command } from "commander";
import { executeCheckCommand } from "../commands/check.js";
import { executeExportCommand } from "../commands/export.js";
import { executeSyncCommand } from "../commands/sync.js";
import {
  type DocsCommonCliOptions,
  type DocsExportCliOptions,
  resolveDocsCliOptions,
  withDocsCommonOptions,
  withDocsExportOptions,
} from "./docs-option-bundle.js";

export interface CreateDocsCommandOptions {
  readonly commandName?: string;
  readonly io?: {
    readonly out?: (line: string) => void;
    readonly err?: (line: string) => void;
  };
}

function getIo(options: CreateDocsCommandOptions | undefined): {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
} {
  return {
    out:
      options?.io?.out ?? ((line: string) => process.stdout.write(`${line}\n`)),
    err:
      options?.io?.err ?? ((line: string) => process.stderr.write(`${line}\n`)),
  };
}

export function createDocsCommand(options?: CreateDocsCommandOptions): Command {
  const io = getIo(options);

  const command = new Command(options?.commandName ?? "docs");
  command.description("Synchronize and verify package docs outputs");

  const syncCommand = withDocsCommonOptions(
    command.command("sync").description("Assemble package docs mirrors locally")
  );

  syncCommand.action(async (cmdOptions: DocsCommonCliOptions) => {
    const code = await executeSyncCommand(
      resolveDocsCliOptions(cmdOptions),
      io
    );
    if (code !== 0) {
      process.exitCode = code;
    }
  });

  const checkCommand = withDocsCommonOptions(
    command
      .command("check")
      .description("Check whether assembled package docs are in sync")
  );

  checkCommand.action(async (cmdOptions: DocsCommonCliOptions) => {
    const code = await executeCheckCommand(
      resolveDocsCliOptions(cmdOptions),
      io
    );
    if (code !== 0) {
      process.exitCode = code;
    }
  });

  const exportCommand = withDocsExportOptions(
    command
      .command("export")
      .description("Export docs artifacts for packages and LLM targets")
  );

  exportCommand.action(async (cmdOptions: DocsExportCliOptions) => {
    const code = await executeExportCommand(
      resolveDocsCliOptions(cmdOptions),
      io
    );
    if (code !== 0) {
      process.exitCode = code;
    }
  });

  return command;
}
