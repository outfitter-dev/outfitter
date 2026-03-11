/**
 * Shared scaffold E2E runner used by the optional test suite and manual script.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  type InitPresetId,
  isValidInitPreset,
} from "../commands/init-option-resolution.js";
import {
  DEFAULT_SCAFFOLD_E2E_PRESETS,
  resolveScaffoldE2EProfile,
  type ScaffoldE2EProfileId,
} from "./config.js";

export { DEFAULT_SCAFFOLD_E2E_PRESETS } from "./config.js";

export interface CommandResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
}

export interface ScaffoldPresetVerificationResult {
  readonly preset: InitPresetId;
  readonly steps: readonly {
    readonly command: string;
    readonly durationMs: number;
  }[];
  readonly targetDir: string;
}

export interface RunScaffoldE2ESuiteOptions {
  readonly profile?: ScaffoldE2EProfileId;
  readonly presets?: readonly InitPresetId[];
  readonly runDir: string;
  readonly timeoutMs?: number;
}

export function resolveScaffoldCliEntry(
  baseDir: string,
  fileExists: (path: string) => boolean = existsSync
): string {
  const sourceEntry = join(baseDir, "..", "cli.ts");
  if (fileExists(sourceEntry)) {
    return sourceEntry;
  }

  const builtEntry = join(baseDir, "..", "cli.js");
  if (fileExists(builtEntry)) {
    return builtEntry;
  }

  throw new Error(`Unable to resolve outfitter CLI entry from ${baseDir}`);
}

const cliEntry = resolveScaffoldCliEntry(import.meta.dir);
const repoRoot = join(import.meta.dir, "..", "..", "..", "..");

function createProjectName(preset: InitPresetId): string {
  return `scaffold-e2e-${preset}`;
}

export function resolveScaffoldE2EPresets(
  values: readonly string[] | undefined
): readonly InitPresetId[] {
  if (!values || values.length === 0) {
    return DEFAULT_SCAFFOLD_E2E_PRESETS;
  }

  const presets = values.flatMap((value) =>
    value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  );

  const invalid = presets.filter((preset) => !isValidInitPreset(preset));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown scaffold E2E preset(s): ${invalid.join(", ")}. Available presets: ${DEFAULT_SCAFFOLD_E2E_PRESETS.join(", ")}`
    );
  }

  return [...new Set(presets)] as InitPresetId[];
}

async function runCommand(
  cwd: string,
  command: readonly string[],
  timeoutMs: number
): Promise<CommandResult> {
  const proc = Bun.spawn([...command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeout = new Promise<"timeout">((resolveTimeout) => {
    const timer = setTimeout(() => resolveTimeout("timeout"), timeoutMs);
    proc.exited.finally(() => clearTimeout(timer));
  });

  const race = await Promise.race([proc.exited.then(() => "exit"), timeout]);
  if (race === "timeout") {
    proc.kill("SIGKILL");
  }

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return {
    exitCode,
    stdout,
    stderr,
    // The race is the timeout source of truth; draining buffered output can
    // finish after the process exits without meaning the command timed out.
    timedOut: race === "timeout",
  };
}

function assertCommandSuccess(
  preset: InitPresetId,
  step: string,
  result: CommandResult
): void {
  if (result.timedOut) {
    throw new Error(
      `[${preset}] ${step} timed out.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  if (result.exitCode !== 0) {
    throw new Error(
      `[${preset}] ${step} failed with exit code ${result.exitCode}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
}

async function runInitViaCli(
  targetDir: string,
  name: string,
  preset: InitPresetId,
  timeoutMs: number
): Promise<CommandResult> {
  return runCommand(
    repoRoot,
    [
      "bun",
      cliEntry,
      "init",
      targetDir,
      "--name",
      name,
      "--preset",
      preset,
      "--yes",
      "--skip-install",
      "--skip-git",
      "--skip-commit",
      // Smoke scaffolds should exercise the default tooling footprint that
      // real `outfitter init` users get, including generated `verify:ci`.
    ],
    timeoutMs
  );
}

export async function runScaffoldE2ESuite(
  options: RunScaffoldE2ESuiteOptions
): Promise<readonly ScaffoldPresetVerificationResult[]> {
  const profile = resolveScaffoldE2EProfile(options.profile);
  const timeoutMs = options.timeoutMs ?? profile.commandTimeoutMs;
  const presets = options.presets ?? profile.presets;
  const results: ScaffoldPresetVerificationResult[] = [];

  for (const preset of presets) {
    const presetStartedAt = Date.now();
    process.stderr.write(`[scaffold-e2e] starting preset: ${preset}\n`);
    const targetDir = join(options.runDir, preset);
    const steps: { command: string; durationMs: number }[] = [];

    const initStartedAt = Date.now();
    const init = await runInitViaCli(
      targetDir,
      createProjectName(preset),
      preset,
      timeoutMs
    );
    assertCommandSuccess(preset, "outfitter init", init);
    steps.push({
      command: "outfitter init",
      durationMs: Date.now() - initStartedAt,
    });

    const installStartedAt = Date.now();
    const install = await runCommand(targetDir, ["bun", "install"], timeoutMs);
    assertCommandSuccess(preset, "bun install", install);
    steps.push({
      command: "bun install",
      durationMs: Date.now() - installStartedAt,
    });

    const verifyStartedAt = Date.now();
    const verify = await runCommand(
      targetDir,
      ["bun", "run", "verify:ci"],
      timeoutMs
    );
    assertCommandSuccess(preset, "bun run verify:ci", verify);
    steps.push({
      command: "bun run verify:ci",
      durationMs: Date.now() - verifyStartedAt,
    });

    results.push({
      preset,
      targetDir,
      steps,
    });
    const presetDurationMs = Date.now() - presetStartedAt;
    process.stderr.write(
      `[scaffold-e2e] completed preset: ${preset} (${presetDurationMs}ms)\n`
    );
  }

  return results;
}
