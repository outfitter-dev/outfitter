/**
 * Compatibility bridge for `outfitter demo`.
 *
 * The demo implementation now lives in `apps/cli-demo`.
 * This command forwards to the dedicated demo CLI when available.
 *
 * @packageDocumentation
 */

import type { CliOutputMode } from "../output-mode.js";

/**
 * Options for forwarding to the demo CLI.
 */
export interface DemoOptions {
  readonly section?: string | undefined;
  readonly list?: boolean | undefined;
  readonly animate?: boolean | undefined;
  readonly outputMode: CliOutputMode;
}

/**
 * Result of forwarding the demo command.
 */
export interface DemoResult {
  readonly exitCode: number;
}

function isCommandNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /ENOENT|not found|spawn/i.test(error.message);
}

async function tryRun(cmd: string[]): Promise<number | undefined> {
  try {
    const proc = Bun.spawn({
      cmd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    return await proc.exited;
  } catch (error) {
    if (isCommandNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function localDemoCmds(args: string[]): Promise<string[][]> {
  const localDistPath = new URL(
    "../../../cli-demo/dist/cli.js",
    import.meta.url
  ).pathname;
  const localSrcPath = new URL("../../../cli-demo/src/cli.ts", import.meta.url)
    .pathname;

  const cmds: string[][] = [];

  if (await Bun.file(localDistPath).exists()) {
    cmds.push([process.execPath, localDistPath, ...args]);
  }

  if (await Bun.file(localSrcPath).exists()) {
    cmds.push([process.execPath, localSrcPath, ...args]);
  }

  return cmds;
}

function toCliArgs(options: DemoOptions): string[] {
  const args: string[] = [];

  if (options.section) {
    args.push(options.section);
  }

  if (options.list) {
    args.push("--list");
  }

  if (options.animate) {
    args.push("--animate");
  }

  if (options.outputMode === "json") {
    args.push("--json");
  } else if (options.outputMode === "jsonl") {
    args.push("--jsonl");
  }

  return args;
}

/**
 * Runs the demo command through available entrypoints.
 */
export async function runDemo(options: DemoOptions): Promise<DemoResult> {
  const args = toCliArgs(options);

  const commandCandidates: string[][] = [
    ["outfitter-demo", ...args],
    ["cli-demo", ...args],
    ["outfitter-showcase", ...args],
    ["cli-showcase", ...args],
    ...(await localDemoCmds(args)),
  ];

  for (const cmd of commandCandidates) {
    const exitCode = await tryRun(cmd);
    if (exitCode !== undefined) {
      return { exitCode };
    }
  }

  throw new Error(
    [
      "Demo functionality moved to the dedicated demo app.",
      "",
      "Run one of:",
      "  outfitter-demo --help",
      "  cli-demo --help",
      "  outfitter-showcase --help (compatibility alias)",
      "  cli-showcase --help (compatibility alias)",
      "",
      "In this monorepo, you can also run:",
      "  bun run apps/cli-demo/src/cli.ts --help",
    ].join("\n")
  );
}
