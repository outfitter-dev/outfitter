import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";
import {
  generatePackageListSection,
  replaceSentinelSection,
} from "@outfitter/docs";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

const SECTION_ID = "PACKAGE_LIST";
const BEGIN_TAG = `<!-- BEGIN:GENERATED:${SECTION_ID} -->`;
const END_TAG = `<!-- END:GENERATED:${SECTION_ID} -->`;

export type DocsReadmeSentinelCheckReason =
  | "missing-markers"
  | "out-of-date"
  | "up-to-date";

export interface DocsReadmeSentinelCheckResult {
  readonly reason: DocsReadmeSentinelCheckReason;
  readonly updatedContent: string;
}

export interface CheckDocsSentinelOptions {
  readonly cwd: string;
}

export interface CheckDocsSentinelResult {
  readonly ok: boolean;
  readonly readmePath: string;
  readonly reason: DocsReadmeSentinelCheckReason;
  readonly updatedContent: string;
}

export class CheckDocsSentinelError extends Error {
  readonly _tag = "CheckDocsSentinelError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckDocsSentinelError";
  }
}

export function checkDocsReadmeSentinelContent(
  readmeContent: string,
  packageListContent: string
): DocsReadmeSentinelCheckResult {
  if (!(readmeContent.includes(BEGIN_TAG) && readmeContent.includes(END_TAG))) {
    return { reason: "missing-markers", updatedContent: readmeContent };
  }

  const updatedContent = replaceSentinelSection(
    readmeContent,
    SECTION_ID,
    packageListContent
  );

  if (updatedContent !== readmeContent) {
    return { reason: "out-of-date", updatedContent };
  }

  return { reason: "up-to-date", updatedContent };
}

export async function runCheckDocsSentinel(
  options: CheckDocsSentinelOptions
): Promise<Result<CheckDocsSentinelResult, CheckDocsSentinelError>> {
  try {
    const workspaceRoot = resolve(options.cwd);
    const readmePath = join(workspaceRoot, "docs", "README.md");

    const [readmeContent, packageListContent] = await Promise.all([
      readFile(readmePath, "utf8"),
      generatePackageListSection(workspaceRoot),
    ]);

    const result = checkDocsReadmeSentinelContent(
      readmeContent,
      packageListContent
    );

    return Result.ok({
      readmePath,
      reason: result.reason,
      updatedContent: result.updatedContent,
      ok: result.reason === "up-to-date",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check docs README sentinel";
    return Result.err(new CheckDocsSentinelError(message));
  }
}

export async function printCheckDocsSentinelResult(
  result: CheckDocsSentinelResult,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    const serialized =
      structuredMode === "json"
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);
    process.stdout.write(`${serialized}\n`);
    return;
  }

  if (result.reason === "up-to-date") {
    process.stdout.write(
      "docs/README.md PACKAGE_LIST sentinel is up to date.\n"
    );
    return;
  }

  if (result.reason === "missing-markers") {
    process.stderr.write(
      "docs/README.md is missing PACKAGE_LIST sentinel markers.\nRun 'bun run docs:sync:readme' to regenerate sentinel sections.\n"
    );
    return;
  }

  process.stderr.write(
    "docs/README.md PACKAGE_LIST sentinel is stale.\nRun 'bun run docs:sync:readme' to regenerate sentinel sections.\n"
  );
}

interface ParsedCliArgs {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  let cwd = process.cwd();
  let outputMode: CliOutputMode = "human";

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--cwd") {
      const value = argv[index + 1];
      if (!value) {
        throw new CheckDocsSentinelError("Missing value for --cwd");
      }
      cwd = value;
      index += 1;
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
  }

  return {
    cwd: resolve(cwd),
    outputMode,
  };
}

export async function runCheckDocsSentinelFromArgv(
  argv: readonly string[]
): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid command arguments";
    process.stderr.write(`${message}\n`);
    return 1;
  }

  const result = await runCheckDocsSentinel({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckDocsSentinelResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckDocsSentinelFromArgv(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
