/**
 * Compatibility bridge for `outfitter demo`.
 *
 * The demo implementation now lives in `apps/cli-demo`.
 * This command forwards to the dedicated demo CLI when available.
 *
 * @packageDocumentation
 */

import { fileURLToPath } from "node:url";
import { output } from "@outfitter/cli";
import {
  getPrimitiveIds,
  isPrimitiveId,
  renderAllDemos,
  renderDemo,
} from "@outfitter/tui/demo";
import type { CliOutputMode } from "../output-mode.js";

const EMBEDDED_DEMO_FLAG = "--__outfitter-embedded-demo";

/**
 * Options for forwarding to the demo CLI.
 */
export interface DemoOptions {
  readonly animate?: boolean | undefined;
  readonly list?: boolean | undefined;
  readonly outputMode: CliOutputMode;
  readonly section?: string | undefined;
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
  const localDistPath = fileURLToPath(
    new URL("../../../cli-demo/dist/cli.js", import.meta.url)
  );
  const localSrcPath = fileURLToPath(
    new URL("../../../cli-demo/src/cli.ts", import.meta.url)
  );

  const cmds: string[][] = [];

  if (await Bun.file(localDistPath).exists()) {
    cmds.push([process.execPath, localDistPath, ...args]);
  }

  if (await Bun.file(localSrcPath).exists()) {
    cmds.push([process.execPath, localSrcPath, ...args]);
  }

  return cmds;
}

function embeddedDemoCmd(args: string[]): string[] {
  return [
    process.execPath,
    fileURLToPath(import.meta.url),
    EMBEDDED_DEMO_FLAG,
    ...args,
  ];
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

function toOutputMode(mode: CliOutputMode): "human" | "json" | "jsonl" {
  return mode;
}

function renderListSections(): string {
  const sections = getPrimitiveIds();
  return [
    "Available demo sections:",
    ...sections.map((s) => `- ${s}`),
    "- all",
  ].join("\n");
}

function renderUnknownSection(section: string): string {
  const sections = getPrimitiveIds();
  return [
    `Unknown section: ${section}`,
    "",
    `Available sections: ${sections.join(", ")}, all`,
    "",
    "For app-specific sections (for example `errors`), run `outfitter-demo`.",
  ].join("\n");
}

function parseEmbeddedOptions(argv: readonly string[]): DemoOptions {
  let section: string | undefined;
  let list = false;
  let animate = false;
  let outputMode: CliOutputMode = "human";

  for (const arg of argv) {
    if (arg === "--list" || arg === "-l") {
      list = true;
      continue;
    }

    if (arg === "--animate" || arg === "-a") {
      animate = true;
      continue;
    }

    if (arg === "--json") {
      outputMode = "json";
      continue;
    }

    if (arg === "--jsonl") {
      outputMode = "jsonl";
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (section !== undefined) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    section = arg;
  }

  return { section, list, animate, outputMode };
}

async function runEmbeddedDemo(options: DemoOptions): Promise<number> {
  const mode = toOutputMode(options.outputMode);

  if (options.list) {
    await output(renderListSections(), { mode });
    return 0;
  }

  if (options.animate) {
    await output(renderDemo("spinner"), { mode });
    return 0;
  }

  if (options.section === undefined || options.section === "all") {
    await output(renderAllDemos(), { mode });
    return 0;
  }

  if (!isPrimitiveId(options.section)) {
    await output(renderUnknownSection(options.section), { mode });
    return 1;
  }

  await output(renderDemo(options.section), { mode });
  return 0;
}

async function runEmbeddedFromArgv(): Promise<void> {
  if (process.argv[2] !== EMBEDDED_DEMO_FLAG) {
    return;
  }

  const options = parseEmbeddedOptions(process.argv.slice(3));
  const exitCode = await runEmbeddedDemo(options);
  process.exit(exitCode);
}

if (import.meta.main) {
  void runEmbeddedFromArgv().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

/**
 * Runs the demo command through available entrypoints.
 */
export async function runDemo(options: DemoOptions): Promise<DemoResult> {
  const args = toCliArgs(options);

  const commandCandidates: string[][] = [
    ["outfitter-demo", ...args],
    ["cli-demo", ...args],
    ...(await localDemoCmds(args)),
    embeddedDemoCmd(args),
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
      "",
      "In this monorepo, you can also run:",
      "  bun run apps/cli-demo/src/cli.ts --help",
    ].join("\n")
  );
}
