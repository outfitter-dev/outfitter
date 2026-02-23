import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { executeCheckCommand } from "../commands/check.js";
import { executeExportCommand } from "../commands/export.js";
import { executeSyncCommand } from "../commands/sync.js";
import {
  generatePackageListSection,
  replaceSentinelSection,
} from "../core/sentinel-generator.js";
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

  const syncReadmeCommand = withDocsCommonOptions(
    command
      .command("sync-readme")
      .description("Update sentinel-wrapped sections in docs/README.md")
  );

  syncReadmeCommand.action(async (cmdOptions: DocsCommonCliOptions) => {
    const resolved = resolveDocsCliOptions(cmdOptions);
    const workspaceRoot = resolve(resolved.cwd ?? process.cwd());
    const readmePath = join(workspaceRoot, "docs", "README.md");
    const sectionId = "PACKAGE_LIST";
    const beginTag = `<!-- BEGIN:GENERATED:${sectionId} -->`;
    const endTag = `<!-- END:GENERATED:${sectionId} -->`;

    const [readmeContent, packageListContent] = await Promise.all([
      readFile(readmePath, "utf8"),
      generatePackageListSection(workspaceRoot),
    ]);

    if (!(readmeContent.includes(beginTag) && readmeContent.includes(endTag))) {
      io.err("docs/README.md is missing PACKAGE_LIST sentinel markers.");
      process.exitCode = 1;
      return;
    }

    const updated = replaceSentinelSection(
      readmeContent,
      sectionId,
      packageListContent
    );

    if (updated === readmeContent) {
      io.out("docs/README.md is up to date.");
      return;
    }

    await writeFile(readmePath, updated, "utf8");
    io.out("docs/README.md updated with generated package list.");
  });

  return command;
}
