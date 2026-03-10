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
  readonly spawn?: typeof Bun.spawn;
  readonly stderrTargets?: readonly OutputTarget[];
  readonly stdoutTargets?: readonly OutputTarget[];
  readonly timeoutMs: number;
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

async function mirrorStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  targets: readonly OutputTarget[] | undefined,
  onChunk: () => void
): Promise<void> {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
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
    reader.releaseLock();
  }
}

export async function runStreamedCommand(
  options: RunStreamedCommandOptions
): Promise<StreamCommandResult> {
  const spawn = options.spawn ?? Bun.spawn;
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

  const heartbeatTimer =
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

  const timeout = new Promise<"timeout">((resolveTimeout) => {
    const timer = setTimeout(
      () => resolveTimeout("timeout"),
      options.timeoutMs
    );
    handle.exited.finally(() => clearTimeout(timer));
  });

  try {
    const race = await Promise.race([
      handle.exited.then(() => "exit"),
      timeout,
    ]);
    if (race === "timeout") {
      handle.kill("SIGKILL");
    }

    const [exitCode] = await Promise.all([
      handle.exited,
      mirrorStream(handle.stdout, options.stdoutTargets, markOutput),
      mirrorStream(handle.stderr, options.stderrTargets, markOutput),
    ]);

    return {
      durationMs: Date.now() - startedAtMs,
      exitCode,
      timedOut: race === "timeout",
    };
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}
