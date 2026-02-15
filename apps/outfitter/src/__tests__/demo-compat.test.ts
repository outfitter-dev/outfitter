/**
 * Compatibility tests for `outfitter demo`.
 *
 * Verifies the command forwards to the dedicated demo app while preserving
 * the `outfitter demo` bridge entrypoint.
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, test } from "bun:test";
import { runDemo } from "../commands/demo.js";

type SpawnResult =
  | { type: "exit"; code: number }
  | { type: "throw"; error: Error };

const originalSpawn = Bun.spawn;
let spawnCalls: string[][] = [];

function getCommandFromSpawnArg(arg: unknown): string[] {
  if (Array.isArray(arg)) {
    return [...(arg as string[])];
  }

  if (typeof arg === "object" && arg !== null && "cmd" in arg) {
    const cmd = (arg as { cmd?: unknown }).cmd;
    if (Array.isArray(cmd)) {
      return [...(cmd as string[])];
    }
  }

  throw new Error(
    "Unexpected Bun.spawn argument shape in demo compatibility test"
  );
}

function mockSpawn(handler: (cmd: string[]) => SpawnResult): void {
  const mocked = ((arg: unknown) => {
    const cmd = getCommandFromSpawnArg(arg);
    spawnCalls.push(cmd);

    const outcome = handler(cmd);
    if (outcome.type === "throw") {
      throw outcome.error;
    }

    return {
      exited: Promise.resolve(outcome.code),
      stdout: new Response("").body,
      stderr: new Response("").body,
    } as unknown as ReturnType<typeof Bun.spawn>;
  }) as typeof Bun.spawn;

  Object.assign(Bun, { spawn: mocked });
}

afterEach(() => {
  spawnCalls = [];
  Object.assign(Bun, { spawn: originalSpawn });
});

describe("demo compatibility bridge", () => {
  test("forwards flags to outfitter-demo when available", async () => {
    mockSpawn((cmd) => {
      if (cmd[0] === "outfitter-demo") {
        return { type: "exit", code: 0 };
      }
      return { type: "throw", error: new Error("spawn ENOENT") };
    });

    const result = await runDemo({
      section: "colors",
      list: true,
      animate: true,
      outputMode: "jsonl",
    });

    expect(result.exitCode).toBe(0);
    expect(spawnCalls[0]).toEqual([
      "outfitter-demo",
      "colors",
      "--list",
      "--animate",
      "--jsonl",
    ]);
    expect(spawnCalls).toHaveLength(1);
  });

  test("falls back to monorepo demo command when bins are missing", async () => {
    mockSpawn((cmd) => {
      if (cmd[0] === "outfitter-demo" || cmd[0] === "cli-demo") {
        return { type: "throw", error: new Error("spawn ENOENT") };
      }

      if (cmd[0] === process.execPath && cmd[1]?.includes("/cli-demo/")) {
        return { type: "exit", code: 0 };
      }

      return { type: "throw", error: new Error("spawn ENOENT") };
    });

    const result = await runDemo({
      section: "errors",
      outputMode: "text",
    });

    expect(result.exitCode).toBe(0);
    expect(spawnCalls[0]?.[0]).toBe("outfitter-demo");
    expect(spawnCalls[1]?.[0]).toBe("cli-demo");
    expect(
      spawnCalls.some(
        (cmd) => cmd[0] === process.execPath && cmd[1]?.includes("/cli-demo/")
      )
    ).toBe(true);
  });

  test("falls back to embedded demo runner when dedicated app is unavailable", async () => {
    mockSpawn((cmd) => {
      if (cmd[0] === "outfitter-demo" || cmd[0] === "cli-demo") {
        return { type: "throw", error: new Error("spawn ENOENT") };
      }

      if (cmd[0] === process.execPath && cmd[1]?.includes("/cli-demo/")) {
        return { type: "throw", error: new Error("spawn ENOENT") };
      }

      if (cmd[0] === process.execPath && cmd[1]?.includes("/commands/demo.")) {
        return { type: "exit", code: 0 };
      }

      return { type: "throw", error: new Error("spawn ENOENT") };
    });

    const result = await runDemo({
      section: "colors",
      outputMode: "text",
    });

    expect(result.exitCode).toBe(0);
    expect(
      spawnCalls.some(
        (cmd) =>
          cmd[0] === process.execPath &&
          cmd[1]?.includes("/commands/demo.") &&
          cmd.includes("--__outfitter-embedded-demo")
      )
    ).toBe(true);
  });

  test("throws actionable guidance when demo entrypoints are unavailable", async () => {
    mockSpawn(() => ({ type: "throw", error: new Error("spawn ENOENT") }));

    await expect(
      runDemo({
        section: "colors",
        outputMode: "text",
      })
    ).rejects.toThrow("outfitter-demo --help");

    await expect(
      runDemo({
        section: "colors",
        outputMode: "text",
      })
    ).rejects.toThrow("cli-demo --help");
  });
});
