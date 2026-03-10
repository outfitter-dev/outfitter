import { describe, expect, spyOn, test } from "bun:test";

import {
  DEFAULT_SCAFFOLD_E2E_PRESETS,
  resolveScaffoldE2EPresets,
  runScaffoldE2ESuite,
} from "../scaffold-e2e/runner.js";

function createTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function createSpawnResult(input: {
  exitCode: number | Promise<number>;
  onKill?: (signal?: string) => void;
  stderr?: string;
  stdout?: string;
}): ReturnType<typeof Bun.spawn> {
  const exitCodePromise =
    typeof input.exitCode === "number"
      ? Promise.resolve(input.exitCode)
      : input.exitCode;

  return {
    exited: exitCodePromise,
    kill: input.onKill,
    stdout: createTextStream(input.stdout ?? ""),
    stderr: createTextStream(input.stderr ?? ""),
  } as unknown as ReturnType<typeof Bun.spawn>;
}

describe("scaffold e2e runner preset resolution", () => {
  test("defaults to CLI, library, and full-stack first", () => {
    expect(DEFAULT_SCAFFOLD_E2E_PRESETS).toEqual([
      "cli",
      "library",
      "full-stack",
      "minimal",
      "mcp",
      "daemon",
    ]);
  });

  test("supports repeated and comma-separated preset arguments", () => {
    expect(
      resolveScaffoldE2EPresets(["cli,library", "full-stack", "cli"])
    ).toEqual(["cli", "library", "full-stack"]);
  });

  test("rejects unknown presets", () => {
    expect(() => resolveScaffoldE2EPresets(["cli", "unknown"])).toThrow(
      "Unknown scaffold E2E preset(s): unknown"
    );
  });

  test("keeps default tooling enabled for smoke scaffolds", async () => {
    const commands: string[][] = [];
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((command) => {
      commands.push([...(command as string[])]);
      return createSpawnResult({ exitCode: 0 });
    });

    try {
      const results = await runScaffoldE2ESuite({
        runDir: "/tmp/outfitter-scaffold-e2e-runner",
        presets: ["cli"],
      });

      expect(results).toHaveLength(1);
      expect(commands[0]).toBeDefined();
      expect(commands[0]).not.toContain("--no-tooling");
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test("uses the ci smoke profile when requested", async () => {
    const commands: string[][] = [];
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((command) => {
      commands.push([...(command as string[])]);
      return createSpawnResult({ exitCode: 0 });
    });

    try {
      const results = await runScaffoldE2ESuite({
        profile: "ci",
        runDir: "/tmp/outfitter-scaffold-e2e-runner-ci",
      });

      expect(results.map((result) => result.preset)).toEqual([
        "cli",
        "library",
        "full-stack",
      ]);
      expect(commands).toHaveLength(9);
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test("kills timed-out commands with SIGKILL", async () => {
    let resolveExitCode: ((value: number) => void) | undefined;
    const timedOutExitCode = new Promise<number>((resolve) => {
      resolveExitCode = resolve;
    });
    let killedWith: string | undefined;
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() =>
      createSpawnResult({
        exitCode: timedOutExitCode,
        onKill: (signal) => {
          killedWith = signal;
          resolveExitCode?.(1);
        },
      })
    );

    try {
      await expect(
        runScaffoldE2ESuite({
          runDir: "/tmp/outfitter-scaffold-e2e-runner-timeout",
          presets: ["cli"],
          timeoutMs: 1,
        })
      ).rejects.toThrow("[cli] outfitter init timed out.");
      expect(killedWith).toBe("SIGKILL");
    } finally {
      spawnSpy.mockRestore();
    }
  });
});
