import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

export interface SurfaceMapFormatCheckResult {
  readonly actual: string;
  readonly expected: string;
  readonly filePath: string;
  readonly ok: boolean;
}

export interface CheckSurfaceMapFormatOptions {
  readonly cwd: string;
}

export interface CheckSurfaceMapFormatResult {
  readonly filePath: string;
  readonly format: SurfaceMapFormatCheckResult | null;
  readonly ok: boolean;
  readonly reason: "format-drift" | "missing-file" | "ok";
}

export class CheckSurfaceMapFormatError extends Error {
  readonly _tag = "CheckSurfaceMapFormatError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckSurfaceMapFormatError";
  }
}

export function canonicalizeJson(content: string, filePath: string): string {
  const parsed = JSON.parse(content) as unknown;
  const normalized = `${JSON.stringify(parsed, null, 2)}\n`;
  const formatResult = spawnSync(
    "bun",
    ["x", "oxfmt", "--stdin-filepath", filePath],
    {
      encoding: "utf-8",
      input: normalized,
    }
  );

  if (
    formatResult.status !== 0 ||
    typeof formatResult.stdout !== "string" ||
    formatResult.stdout.length === 0
  ) {
    return normalized;
  }

  return formatResult.stdout.endsWith("\n")
    ? formatResult.stdout
    : `${formatResult.stdout}\n`;
}

export function checkSurfaceMapFormat(
  content: string,
  filePath: string
): SurfaceMapFormatCheckResult {
  const expected = canonicalizeJson(content, filePath);

  return {
    filePath,
    actual: content,
    expected,
    ok: content === expected,
  };
}

export async function runCheckSurfaceMapFormat(
  options: CheckSurfaceMapFormatOptions
): Promise<Result<CheckSurfaceMapFormatResult, CheckSurfaceMapFormatError>> {
  try {
    const filePath = join(resolve(options.cwd), ".outfitter", "surface.json");
    if (!existsSync(filePath)) {
      return Result.ok({
        filePath,
        format: null,
        ok: false,
        reason: "missing-file",
      });
    }

    const content = readFileSync(filePath, "utf-8");
    const formatResult = checkSurfaceMapFormat(content, filePath);

    if (formatResult.ok) {
      return Result.ok({
        filePath,
        format: formatResult,
        ok: true,
        reason: "ok",
      });
    }

    return Result.ok({
      filePath,
      format: formatResult,
      ok: false,
      reason: "format-drift",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check surface map formatting";
    return Result.err(new CheckSurfaceMapFormatError(message));
  }
}

export async function printCheckSurfaceMapFormatResult(
  result: CheckSurfaceMapFormatResult,
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

  if (result.reason === "missing-file") {
    process.stderr.write(
      `[surface-map-format] Missing ${result.filePath}\nRun 'bun run apps/outfitter/src/cli.ts schema generate' from repo root.\n`
    );
    return;
  }

  if (result.reason === "ok") {
    process.stdout.write(
      `[surface-map-format] ${result.filePath} matches canonical formatting\n`
    );
    return;
  }

  process.stderr.write(
    [
      `[surface-map-format] ${result.filePath} is not canonically formatted.`,
      "Run 'bun run apps/outfitter/src/cli.ts schema generate' from repo root to rewrite .outfitter/surface.json.",
    ].join("\n")
  );
  process.stderr.write("\n");
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
        throw new CheckSurfaceMapFormatError("Missing value for --cwd");
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

export async function runCheckSurfaceMapFormatFromArgv(
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

  const result = await runCheckSurfaceMapFormat({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckSurfaceMapFormatResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckSurfaceMapFormatFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
