/**
 * Shared streamed subprocess runner for long-lived repo workflows.
 *
 * @packageDocumentation
 */

export interface StreamCommandHeartbeat {
  readonly command: readonly string[];
  readonly elapsedMs: number;
  readonly idleMs: number;
  readonly timeoutMs: number;
}

export interface StreamCommandResult {
  readonly durationMs: number;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

type OutputTarget = Pick<typeof process.stdout, "write">;

export interface RunStreamedCommandOptions {
  readonly command: readonly string[];
  readonly cwd: string;
  readonly heartbeatIntervalMs?: number;
  readonly onHeartbeat?:
    | ((heartbeat: StreamCommandHeartbeat) => void)
    | undefined;
  readonly postExitDrainTimeoutMs?: number;
  readonly postKillDrainTimeoutMs?: number;
  readonly spawn?: typeof Bun.spawn;
  readonly stderrTargets?: readonly OutputTarget[];
  readonly stdoutTargets?: readonly OutputTarget[];
  readonly timeoutMs: number;
}

const DEFAULT_POST_EXIT_DRAIN_TIMEOUT_MS = 5_000;
const DEFAULT_POST_KILL_DRAIN_TIMEOUT_MS = 5_000;

interface MirroredStream {
  cancel(): Promise<void>;
  readonly done: Promise<void>;
}

function writeToTargets(
  targets: readonly OutputTarget[] | undefined,
  chunk: Uint8Array
): void {
  if (!targets || targets.length === 0) {
    return;
  }

  for (const target of targets) {
    target.write(chunk);
  }
}

function mirrorStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  targets: readonly OutputTarget[] | undefined,
  onChunk: () => void
): MirroredStream {
  if (!stream) {
    return {
      async cancel() {},
      done: Promise.resolve(),
    };
  }

  const reader = stream.getReader();
  let released = false;

  const done = (async (): Promise<void> => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value || value.length === 0) {
          continue;
        }

        onChunk();
        writeToTargets(targets, value);
      }
    } finally {
      released = true;
      reader.releaseLock();
    }
  })();

  return {
    async cancel(): Promise<void> {
      if (released) {
        return;
      }

      try {
        await reader.cancel();
      } catch {}
    },
    done,
  };
}

export async function runStreamedCommand(
  options: RunStreamedCommandOptions
): Promise<StreamCommandResult> {
  const spawn = options.spawn ?? Bun.spawn;
  const postExitDrainTimeoutMs =
    options.postExitDrainTimeoutMs ?? DEFAULT_POST_EXIT_DRAIN_TIMEOUT_MS;
  const postKillDrainTimeoutMs =
    options.postKillDrainTimeoutMs ?? DEFAULT_POST_KILL_DRAIN_TIMEOUT_MS;
  const startedAtMs = Date.now();
  let lastOutputAtMs = startedAtMs;

  const handle = spawn([...options.command], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const markOutput = (): void => {
    lastOutputAtMs = Date.now();
  };

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined =
    options.heartbeatIntervalMs && options.heartbeatIntervalMs > 0
      ? setInterval(() => {
          options.onHeartbeat?.({
            command: options.command,
            elapsedMs: Date.now() - startedAtMs,
            idleMs: Date.now() - lastOutputAtMs,
            timeoutMs: options.timeoutMs,
          });
        }, options.heartbeatIntervalMs)
      : undefined;

  const clearHeartbeatTimer = (): void => {
    if (!heartbeatTimer) {
      return;
    }

    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const timeout = new Promise<"timeout">((resolveTimeout) => {
    const timer = setTimeout(
      () => resolveTimeout("timeout"),
      options.timeoutMs
    );
    handle.exited.finally(() => clearTimeout(timer));
  });

  // Start draining immediately so subprocess output cannot block on full pipes.
  const stdoutStream = mirrorStream(
    handle.stdout,
    options.stdoutTargets,
    markOutput
  );
  const stderrStream = mirrorStream(
    handle.stderr,
    options.stderrTargets,
    markOutput
  );
  const drainStreams = Promise.all([stdoutStream.done, stderrStream.done]).then(
    () => undefined
  );

  const cancelDrainStreams = async (): Promise<void> => {
    await Promise.allSettled([stdoutStream.cancel(), stderrStream.cancel()]);
  };

  try {
    const race = await Promise.race([
      handle.exited.then(() => "exit" as const),
      timeout,
    ]);
    clearHeartbeatTimer();

    if (race === "timeout") {
      handle.kill("SIGKILL");
    }

    const exitCode =
      race === "timeout"
        ? await Promise.race([
            Promise.all([handle.exited, drainStreams]).then(
              ([resolvedExitCode]) => resolvedExitCode
            ),
            // Guard against pathological cases where SIGKILL still doesn't unblock exit.
            Bun.sleep(postKillDrainTimeoutMs).then(async () => {
              await cancelDrainStreams();
              return 124;
            }),
          ])
        : await handle.exited.then(async (resolvedExitCode) => {
            await Promise.race([
              drainStreams,
              // Guard against grandchildren keeping inherited pipes open after exit.
              Bun.sleep(postExitDrainTimeoutMs).then(async () => {
                await cancelDrainStreams();
              }),
            ]);

            return resolvedExitCode;
          });

    return {
      durationMs: Date.now() - startedAtMs,
      exitCode,
      timedOut: race === "timeout",
    };
  } finally {
    clearHeartbeatTimer();
  }
}
