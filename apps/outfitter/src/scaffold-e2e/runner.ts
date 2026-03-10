/**
 * Shared scaffold E2E runner used by the optional test suite and manual script.
 *
 * @packageDocumentation
 */

import { join } from "node:path";

import {
  type InitPresetId,
  isValidInitPreset,
} from "../commands/init-option-resolution.js";

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
  readonly presets?: readonly InitPresetId[];
  readonly runDir: string;
  readonly timeoutMs?: number;
}

export const DEFAULT_SCAFFOLD_E2E_PRESETS: readonly InitPresetId[] = [
  "cli",
  "library",
  "full-stack",
  "minimal",
  "mcp",
  "daemon",
] as const;

const cliEntry = join(import.meta.dir, "..", "cli.ts");
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

  const startedAt = Date.now();
  const race = await Promise.race([proc.exited.then(() => "exit"), timeout]);
  if (race === "timeout") {
    proc.kill();
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
    timedOut: race === "timeout" || Date.now() - startedAt > timeoutMs,
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
    ],
    timeoutMs
  );
}

export async function runScaffoldE2ESuite(
  options: RunScaffoldE2ESuiteOptions
): Promise<readonly ScaffoldPresetVerificationResult[]> {
  const timeoutMs = options.timeoutMs ?? 240_000;
  const presets = options.presets ?? DEFAULT_SCAFFOLD_E2E_PRESETS;
  const results: ScaffoldPresetVerificationResult[] = [];

  for (const preset of presets) {
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
  }

  return results;
}
