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

function createReaderBackedStream(
  onRead: () => Promise<ReadableStreamReadResult<Uint8Array>>,
  onCancel: () => Promise<void> = async () => {}
): ReadableStream<Uint8Array> {
  return {
    getReader() {
      return {
        cancel: onCancel,
        read: onRead,
        releaseLock() {},
      };
    },
  } as ReadableStream<Uint8Array>;
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

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value: T): void {
      resolvePromise?.(value);
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

  test("starts draining subprocess output before exit resolves", async () => {
    const stdoutChunks: string[] = [];
    const encoder = new TextEncoder();
    const exit = createDeferred<number>();
    const readStarted = createDeferred<void>();
    let readCount = 0;

    const resultPromise = runStreamedCommand({
      command: ["bun", "x", "turbo", "run", "test"],
      cwd: process.cwd(),
      stdoutTargets: [createWritableTarget(stdoutChunks)],
      timeoutMs: 1_000,
      spawn: (() =>
        ({
          exited: exit.promise,
          kill: () => {},
          stderr: createTextStream(""),
          stdout: createReaderBackedStream(async () => {
            readCount += 1;
            if (readCount === 1) {
              readStarted.resolve();
              return {
                done: false,
                value: encoder.encode("stdout\n"),
              };
            }

            return {
              done: true,
              value: undefined,
            };
          }),
        }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
    });

    const startedBeforeExit = await Promise.race([
      readStarted.promise.then(() => true),
      Bun.sleep(25).then(() => false),
    ]);

    exit.resolve(0);
    const result = await resultPromise;

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(startedBeforeExit).toBe(true);
    expect(stdoutChunks.join("")).toBe("stdout\n");
  });

  test("stops heartbeats as soon as the subprocess exit is known", async () => {
    const encoder = new TextEncoder();
    const exit = createDeferred<number>();
    const releaseDrain = createDeferred<void>();
    const heartbeats: StreamCommandHeartbeat[] = [];
    let readCount = 0;

    const resultPromise = runStreamedCommand({
      command: ["bun", "x", "turbo", "run", "test"],
      cwd: process.cwd(),
      heartbeatIntervalMs: 10,
      onHeartbeat: (heartbeat) => {
        heartbeats.push(heartbeat);
      },
      timeoutMs: 1_000,
      spawn: (() =>
        ({
          exited: exit.promise,
          kill: () => {},
          stderr: createTextStream(""),
          stdout: createReaderBackedStream(async () => {
            readCount += 1;
            if (readCount === 1) {
              return {
                done: false,
                value: encoder.encode("stdout\n"),
              };
            }

            await releaseDrain.promise;
            return {
              done: true,
              value: undefined,
            };
          }),
        }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
    });

    exit.resolve(0);
    await Bun.sleep(35);
    releaseDrain.resolve();

    const result = await resultPromise;

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(heartbeats).toEqual([]);
  });

  test("stops waiting forever when a timed out subprocess never drains", async () => {
    const killSignals: string[] = [];

    const settled = await Promise.race([
      runStreamedCommand({
        command: ["bun", "x", "turbo", "run", "test"],
        cwd: process.cwd(),
        timeoutMs: 10,
        spawn: (() =>
          ({
            exited: new Promise<number>(() => {}),
            kill: (signal?: string | number) => {
              killSignals.push(String(signal));
            },
            stderr: createReaderBackedStream(
              async () =>
                await new Promise<ReadableStreamReadResult<Uint8Array>>(
                  () => {}
                )
            ),
            stdout: createReaderBackedStream(
              async () =>
                await new Promise<ReadableStreamReadResult<Uint8Array>>(
                  () => {}
                )
            ),
          }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
        postKillDrainTimeoutMs: 20,
      } as Parameters<typeof runStreamedCommand>[0]).then((result) => ({
        kind: "result" as const,
        result,
      })),
      Bun.sleep(75).then(() => ({ kind: "hung" as const })),
    ]);

    expect(settled.kind).toBe("result");
    if (settled.kind !== "result") {
      return;
    }

    expect(settled.result.exitCode).toBe(124);
    expect(settled.result.timedOut).toBe(true);
    expect(killSignals).toEqual(["SIGKILL"]);
  });

  test("stops waiting forever when a normally exited subprocess never drains", async () => {
    let cancelCalls = 0;

    const settled = await Promise.race([
      runStreamedCommand({
        command: ["bun", "x", "turbo", "run", "test"],
        cwd: process.cwd(),
        timeoutMs: 1_000,
        spawn: (() =>
          ({
            exited: Promise.resolve(0),
            kill: () => {},
            stderr: createReaderBackedStream(
              async () =>
                await new Promise<ReadableStreamReadResult<Uint8Array>>(
                  () => {}
                ),
              async () => {
                cancelCalls += 1;
              }
            ),
            stdout: createReaderBackedStream(
              async () =>
                await new Promise<ReadableStreamReadResult<Uint8Array>>(
                  () => {}
                ),
              async () => {
                cancelCalls += 1;
              }
            ),
          }) as unknown as ReturnType<typeof Bun.spawn>) as typeof Bun.spawn,
        postExitDrainTimeoutMs: 20,
      } as Parameters<typeof runStreamedCommand>[0]).then((result) => ({
        kind: "result" as const,
        result,
      })),
      Bun.sleep(75).then(() => ({ kind: "hung" as const })),
    ]);

    expect(settled.kind).toBe("result");
    if (settled.kind !== "result") {
      return;
    }

    expect(settled.result.exitCode).toBe(0);
    expect(settled.result.timedOut).toBe(false);
    expect(cancelCalls).toBe(2);
  });
});
