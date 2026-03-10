import { describe, expect, test } from "bun:test";

import {
  runStreamedCommand,
  type StreamCommandHeartbeat,
} from "./run-streamed-command";

function createTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (text.length > 0) {
        controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
}

function createWritableTarget(
  chunks: string[]
): Pick<typeof process.stdout, "write"> {
  return {
    write(chunk: string | Uint8Array): boolean {
      if (typeof chunk === "string") {
        chunks.push(chunk);
      } else {
        chunks.push(new TextDecoder().decode(chunk));
      }
      return true;
    },
  };
}

describe("runStreamedCommand", () => {
  test("streams stdout and stderr to targets", async () => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const result = await runStreamedCommand({
      command: ["echo", "ok"],
      cwd: process.cwd(),
      stderrTargets: [createWritableTarget(stderrChunks)],
      stdoutTargets: [createWritableTarget(stdoutChunks)],
      timeoutMs: 1_000,
      spawn: (() =>
        ({
          exited: Promise.resolve(0),
          kill: () => {},
          stderr: createTextStream("stderr\n"),
          stdout: createTextStream("stdout\n"),
        }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
    });

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(stdoutChunks.join("")).toBe("stdout\n");
    expect(stderrChunks.join("")).toBe("stderr\n");
  });

  test("kills timed out commands and emits heartbeat updates", async () => {
    const heartbeats: StreamCommandHeartbeat[] = [];
    let resolveExitCode: ((value: number) => void) | undefined;
    const exited = new Promise<number>((resolve) => {
      resolveExitCode = resolve;
    });
    const killSignals: string[] = [];

    const resultPromise = runStreamedCommand({
      command: ["sleep", "forever"],
      cwd: process.cwd(),
      heartbeatIntervalMs: 10,
      onHeartbeat: (heartbeat) => {
        if (heartbeat.idleMs >= 10) {
          heartbeats.push(heartbeat);
        }
      },
      timeoutMs: 25,
      spawn: (() =>
        ({
          exited,
          kill: (signal?: string | number) => {
            killSignals.push(String(signal));
            resolveExitCode?.(137);
          },
          stderr: createTextStream(""),
          stdout: createTextStream(""),
        }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
    });

    const result = await resultPromise;

    expect(result.exitCode).toBe(137);
    expect(result.timedOut).toBe(true);
    expect(killSignals).toEqual(["SIGKILL"]);
    expect(heartbeats.length).toBeGreaterThan(0);
  });
});
