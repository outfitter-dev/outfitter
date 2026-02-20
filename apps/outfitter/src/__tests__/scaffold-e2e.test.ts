/**
 * Optional scaffold end-to-end tests.
 *
 * These tests execute real installs and test runs in generated projects.
 * Enable with OUTFITTER_RUN_SCAFFOLD_E2E=1.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../commands/init.js";

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

const SCAFFOLD_E2E_ENABLED = process.env["OUTFITTER_RUN_SCAFFOLD_E2E"] === "1";

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `outfitter-scaffold-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function runCommand(
  cwd: string,
  command: readonly string[],
  timeoutMs = 180_000
): Promise<CommandResult> {
  const proc = Bun.spawn(command, {
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
    timedOut: race === "timeout",
  };
}

function assertCommandSuccess(
  preset: string,
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

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

describe("scaffold e2e verification", () => {
  if (!SCAFFOLD_E2E_ENABLED) {
    test("is disabled unless OUTFITTER_RUN_SCAFFOLD_E2E=1", () => {
      expect(SCAFFOLD_E2E_ENABLED).toBe(false);
    });
    return;
  }

  test(
    "scaffolds each supported preset and runs generated build + tests",
    async () => {
      const presets = [
        "minimal",
        "library",
        "cli",
        "mcp",
        "daemon",
      ] as const;

      for (const preset of presets) {
        const targetDir = join(tempDir, preset);
        const name = `scaffold-e2e-${preset}`;
        const initBase = {
          targetDir,
          name,
          force: false,
          yes: true,
          skipInstall: true,
          skipGit: true,
          skipCommit: true,
          noTooling: true,
        } as const;

        const result = await runInit({ ...initBase, preset });

        if (result.isErr()) {
          throw new Error(
            `[${preset}] init failed: ${result.error.message ?? "unknown error"}`
          );
        }

        const install = await runCommand(targetDir, ["bun", "install"]);
        assertCommandSuccess(preset, "bun install", install);

        const build = await runCommand(targetDir, ["bun", "run", "build"]);
        assertCommandSuccess(preset, "bun run build", build);

        if (preset === "library") {
          const typecheck = await runCommand(targetDir, [
            "bun",
            "run",
            "typecheck",
          ]);
          assertCommandSuccess(preset, "bun run typecheck", typecheck);
        }

        const tests = await runCommand(targetDir, ["bun", "test"]);
        assertCommandSuccess(preset, "bun test", tests);
      }
    },
    { timeout: 600_000 }
  );
});
