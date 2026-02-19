import { resolve } from "node:path";
import type { Command } from "commander";

export type DocsMdxMode = "strict" | "lossy";

export interface DocsCommonCliOptions {
  readonly cwd?: string;
  readonly packagesDir?: string;
  readonly outputDir?: string;
  readonly mdxMode?: DocsMdxMode;
}

export interface DocsExportCliOptions extends DocsCommonCliOptions {
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

export function withDocsCommonOptions<TCommand extends Command>(
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

export function withDocsExportOptions<TCommand extends Command>(
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

export function resolveDocsCliOptions<TOptions extends { cwd?: string }>(
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
