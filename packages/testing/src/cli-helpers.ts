/**
 * @outfitter/testing - CLI Helpers
 *
 * Utilities for capturing CLI output and mocking stdin in tests.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export interface CliTestResult {
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Process exit code */
  exitCode: number;
}

// ============================================================================
// Output Capture
// ============================================================================

class ExitError extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`Process exited with code ${code}`);
    this.code = code;
  }
}

/**
 * Capture stdout/stderr and exit code from an async CLI function.
 */
export async function captureCLI(
  fn: () => Promise<void> | void
): Promise<CliTestResult> {
  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalExit = process.exit.bind(process);
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  process.stdout.write = ((
    chunk: Uint8Array | string,
    _encoding?: unknown,
    cb?: () => void
  ): boolean => {
    stdoutChunks.push(
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
    );
    if (typeof cb === "function") cb();
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((
    chunk: Uint8Array | string,
    _encoding?: unknown,
    cb?: () => void
  ): boolean => {
    stderrChunks.push(
      typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
    );
    if (typeof cb === "function") cb();
    return true;
  }) as typeof process.stderr.write;

  console.log = (...args: unknown[]): void => {
    const line = `${args.map(String).join(" ")}\n`;
    stdoutChunks.push(new TextEncoder().encode(line));
  };

  console.error = (...args: unknown[]): void => {
    const line = `${args.map(String).join(" ")}\n`;
    stderrChunks.push(new TextEncoder().encode(line));
  };

  process.exit = ((code?: number): never => {
    throw new ExitError(code ?? 0);
  }) as typeof process.exit;

  let exitCode = 0;
  try {
    await fn();
  } catch (error) {
    if (error instanceof ExitError) {
      exitCode = error.code;
    } else {
      exitCode = 1;
    }
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }

  const decoder = new TextDecoder("utf-8");

  return {
    stdout: decoder.decode(concatChunks(stdoutChunks)),
    stderr: decoder.decode(concatChunks(stderrChunks)),
    exitCode,
  };
}

// ============================================================================
// Stdin Mock
// ============================================================================

/**
 * Mock stdin with provided input.
 *
 * Returns a restore function for convenience.
 */
export function mockStdin(input: string): { restore: () => void } {
  const originalStdin = process.stdin;
  const encoded = new TextEncoder().encode(input);

  const mockStream = {
    // biome-ignore lint/suspicious/useAwait: async generator needs async keyword even without await
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array, void, unknown> {
      yield encoded;
    },
    fd: 0,
    isTTY: false,
  };

  process.stdin = mockStream as unknown as NodeJS.ReadStream & { fd: 0 };

  return {
    restore: () => {
      process.stdin = originalStdin;
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
