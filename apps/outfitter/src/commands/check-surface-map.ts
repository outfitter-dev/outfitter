import { resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

const LEGACY_SURFACE_MAP_PATH = "apps/outfitter/.outfitter/surface.json";
const LEGACY_ROOT_SURFACE_MAP_PATH = ".outfitter/surface.json";
const CANONICAL_SURFACE_LOCK_PATH = ".outfitter/surface.lock";

export interface CheckSurfaceMapOptions {
  readonly cwd: string;
}

export interface CheckSurfaceMapResult {
  readonly canonicalPath: string;
  readonly legacyPaths: readonly string[];
  readonly ok: boolean;
}

export class CheckSurfaceMapError extends Error {
  readonly _tag = "CheckSurfaceMapError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckSurfaceMapError";
  }
}

function isFileTracked(cwd: string, filePath: string): boolean {
  const check = Bun.spawnSync(
    ["git", "ls-files", "--error-unmatch", filePath],
    {
      cwd,
      stdout: "ignore",
      stderr: "ignore",
    }
  );

  return check.exitCode === 0;
}

export async function runCheckSurfaceMap(
  options: CheckSurfaceMapOptions
): Promise<Result<CheckSurfaceMapResult, CheckSurfaceMapError>> {
  try {
    const cwd = resolve(options.cwd);
    const trackedLegacy: string[] = [];
    for (const path of [
      LEGACY_SURFACE_MAP_PATH,
      LEGACY_ROOT_SURFACE_MAP_PATH,
    ]) {
      if (isFileTracked(cwd, path)) {
        trackedLegacy.push(path);
      }
    }

    return Result.ok({
      canonicalPath: CANONICAL_SURFACE_LOCK_PATH,
      legacyPaths: trackedLegacy,
      ok: trackedLegacy.length === 0,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check canonical surface map path";
    return Result.err(new CheckSurfaceMapError(message));
  }
}

export async function printCheckSurfaceMapResult(
  result: CheckSurfaceMapResult,
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

  if (result.ok) {
    return;
  }

  for (const path of result.legacyPaths) {
    process.stderr.write(
      `${path} must not be tracked. Canonical surface artifact is ${result.canonicalPath}.\n`
    );
  }
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
        throw new CheckSurfaceMapError("Missing value for --cwd");
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

export async function runCheckSurfaceMapFromArgv(
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

  const result = await runCheckSurfaceMap({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckSurfaceMapResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckSurfaceMapFromArgv(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
