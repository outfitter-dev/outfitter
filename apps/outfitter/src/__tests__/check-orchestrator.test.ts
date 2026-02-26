import { describe, expect, spyOn, test } from "bun:test";

import {
  buildCheckOrchestratorPlan,
  parseTreePaths,
  printCheckOrchestratorResults,
  runCheckOrchestrator,
} from "../commands/check-orchestrator.js";

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
  stdout?: string;
  stderr?: string;
}): ReturnType<typeof Bun.spawn> {
  const exitCodePromise =
    typeof input.exitCode === "number"
      ? Promise.resolve(input.exitCode)
      : input.exitCode;

  return {
    exited: exitCodePromise,
    stdout: createTextStream(input.stdout ?? ""),
    stderr: createTextStream(input.stderr ?? ""),
  } as unknown as ReturnType<typeof Bun.spawn>;
}

async function captureStdout(run: () => Promise<void> | void): Promise<string> {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  const writeShim = ((chunk: unknown): boolean => {
    if (typeof chunk === "string") {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(new TextDecoder().decode(chunk));
    } else {
      chunks.push(String(chunk));
    }
    return true;
  }) as typeof process.stdout.write;

  process.stdout.write = writeShim;
  try {
    await run();
    return chunks.join("");
  } finally {
    process.stdout.write = originalWrite;
  }
}

describe("buildCheckOrchestratorPlan", () => {
  test("all mode includes core checks and excludes tests", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "all",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("block-drift");
    expect(stepIds).toContain("typecheck");
    expect(stepIds).toContain("lint-and-format");
    expect(stepIds).toContain("schema-diff");
    expect(stepIds).toContain("tree-clean");
    expect(stepIds).not.toContain("tests");
  });

  test("all mode runs block-drift before typecheck", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "all",
    });
    const stepIds = plan.map((step) => step.id);
    const blockDriftIndex = stepIds.indexOf("block-drift");
    const typecheckIndex = stepIds.indexOf("typecheck");

    expect(blockDriftIndex).toBeLessThan(typecheckIndex);
  });

  test("ci mode includes tests", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "ci",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("tests");
    expect(stepIds.at(-1)).toBe("tests");
    expect(plan.find((step) => step.id === "tests")).toMatchObject({
      command: ["bun", "run", "test:ci"],
    });
  });

  test("pre-push mode runs block drift, hook verify, and schema drift", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-push",
    });

    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({
      id: "block-drift",
      command: [
        "bun",
        "run",
        "apps/outfitter/src/cli.ts",
        "check",
        "--manifest-only",
        "--cwd",
        ".",
      ],
    });
    expect(plan[1]).toMatchObject({
      id: "pre-push-verify",
      command: ["bun", "run", "packages/tooling/src/cli/index.ts", "pre-push"],
    });
    expect(plan[2]).toMatchObject({
      id: "schema-drift",
      command: ["bun", "run", "apps/outfitter/src/cli.ts", "schema", "diff"],
    });
  });

  test("pre-commit mode passes all staged files to ultracite but only TS files to typecheck", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: ["apps/outfitter/src/cli.ts", "README.md"],
    });

    expect(plan[0]).toMatchObject({
      id: "ultracite-fix",
      command: [
        "bun",
        "x",
        "ultracite",
        "fix",
        "README.md",
        "apps/outfitter/src/cli.ts",
      ],
    });
    expect(plan[1]).toMatchObject({
      id: "typecheck",
      command: [
        "./scripts/pre-commit-typecheck.sh",
        "apps/outfitter/src/cli.ts",
      ],
    });
  });

  test("pre-commit mode skips typecheck when only non-TS files staged", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: ["README.md", "docs/guide.md"],
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("ultracite-fix");
    expect(stepIds).not.toContain("typecheck");
    expect(stepIds).toContain("exports");
  });

  test("pre-commit mode includes typecheck fallback when no staged files", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("typecheck");
    expect(plan.find((s) => s.id === "typecheck")).toMatchObject({
      command: ["bun", "run", "typecheck", "--", "--only"],
    });
  });

  test("pre-commit mode syncs agent scaffolding when .claude files change", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: [".claude/settings.json"],
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("sync-agent-scaffolding");
  });
});

describe("parseTreePaths", () => {
  test("parses standard porcelain status lines", () => {
    const output = " M src/index.ts\n?? new-file.ts\nA  added.ts\n";
    expect(parseTreePaths(output)).toEqual([
      "added.ts",
      "new-file.ts",
      "src/index.ts",
    ]);
  });

  test("handles rename entries", () => {
    const output = "R  old-name.ts -> new-name.ts\n";
    expect(parseTreePaths(output)).toEqual(["new-name.ts"]);
  });

  test("skips empty lines", () => {
    const output = " M file.ts\n\n";
    expect(parseTreePaths(output)).toEqual(["file.ts"]);
  });

  test("preserves paths that start with spaces after porcelain prefix", () => {
    // Regression: trim() before slice(3) corrupted paths
    const output = " M file.txt\nMM another.ts\n";
    expect(parseTreePaths(output)).toEqual(["another.ts", "file.txt"]);
  });
});

describe("runCheckOrchestrator", () => {
  test("runs plan steps sequentially", async () => {
    const spawnSyncSpy = spyOn(Bun, "spawnSync").mockReturnValue({
      exitCode: 0,
      stdout: new TextEncoder().encode(""),
      stderr: new TextEncoder().encode(""),
    } as unknown as ReturnType<typeof Bun.spawnSync>);

    const calls: string[][] = [];
    let resolveFirstExitCode: ((value: number) => void) | undefined;
    const firstExitCode = new Promise<number>((resolve) => {
      resolveFirstExitCode = resolve;
    });

    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((command) => {
      calls.push([...(command as string[])]);
      if (calls.length === 1) {
        return createSpawnResult({ exitCode: firstExitCode });
      }
      return createSpawnResult({ exitCode: 0 });
    });

    try {
      const runPromise = runCheckOrchestrator({
        cwd: process.cwd(),
        mode: "pre-push",
      });

      // If orchestration is sequential, step 2 should not spawn before step 1 exits.
      await Promise.resolve();
      expect(calls).toHaveLength(1);

      resolveFirstExitCode?.(0);
      const result = await runPromise;
      expect(result.isOk()).toBe(true);
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual([
        "bun",
        "run",
        "apps/outfitter/src/cli.ts",
        "check",
        "--manifest-only",
        "--cwd",
        ".",
      ]);
      expect(calls[1]).toEqual([
        "bun",
        "run",
        "packages/tooling/src/cli/index.ts",
        "pre-push",
      ]);
      expect(calls[2]).toEqual([
        "bun",
        "run",
        "apps/outfitter/src/cli.ts",
        "schema",
        "diff",
      ]);
    } finally {
      spawnSpy.mockRestore();
      spawnSyncSpy.mockRestore();
    }
  });

  test("stops after first failing step", async () => {
    const spawnSyncSpy = spyOn(Bun, "spawnSync").mockReturnValue({
      exitCode: 0,
      stdout: new TextEncoder().encode(""),
      stderr: new TextEncoder().encode(""),
    } as unknown as ReturnType<typeof Bun.spawnSync>);

    const calls: string[][] = [];
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((command) => {
      calls.push([...(command as string[])]);
      return createSpawnResult({
        exitCode: 1,
        stderr: "fatal",
      });
    });

    try {
      const result = await runCheckOrchestrator({
        cwd: process.cwd(),
        mode: "pre-push",
      });
      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        return;
      }

      expect(calls).toHaveLength(1);
      expect(result.value.failedStepIds).toEqual(["block-drift"]);
      expect(result.value.steps).toHaveLength(1);
      expect(result.value.ok).toBe(false);
    } finally {
      spawnSpy.mockRestore();
      spawnSyncSpy.mockRestore();
    }
  });
});

describe("printCheckOrchestratorResults", () => {
  test("surfaces advisory warnings from successful steps in human mode", async () => {
    const output = await captureStdout(async () => {
      await printCheckOrchestratorResults({
        mode: "all",
        ok: true,
        treeClean: true,
        mutatedPaths: [],
        failedStepIds: [],
        steps: [
          {
            id: "changeset",
            label: "Changeset",
            command: [
              "bun",
              "run",
              "apps/outfitter/src/commands/repo.ts",
              "check",
              "changeset",
              "--cwd",
              ".",
            ],
            exitCode: 0,
            stdout: "",
            stderr:
              "No changeset found.\nConsider adding one with `bun run changeset`.",
            durationMs: 42,
          },
        ],
      });
    });

    expect(output).toContain("Changeset");
    expect(output).toContain("No changeset found.");
    expect(output).toContain("Consider adding one");
  });

  test("json compact mode omits verbose step fields", async () => {
    const output = await captureStdout(async () => {
      await printCheckOrchestratorResults(
        {
          mode: "ci",
          ok: true,
          treeClean: true,
          mutatedPaths: [],
          failedStepIds: [],
          steps: [
            {
              id: "tests",
              label: "Tests",
              command: ["bun", "run", "test:ci"],
              exitCode: 0,
              stdout: "very long output",
              stderr: "warnings",
              durationMs: 100,
            },
          ],
        },
        { mode: "json", compact: true }
      );
    });

    const payload = JSON.parse(output.trim()) as Record<string, unknown>;
    const steps = payload["steps"] as Array<Record<string, unknown>>;
    expect(Array.isArray(steps)).toBe(true);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({
      id: "tests",
      label: "Tests",
      exitCode: 0,
      durationMs: 100,
    });
    expect(payload["mode"]).toBe("ci");
    expect(payload["ok"]).toBe(true);
  });
});
