import type { Result } from "@outfitter/contracts";

/**
 * Package code returns Result types and lets CLI adapters decide
 * whether to exit. process.kill is fine for signal handling.
 */
export function shutdown(): Result<void, Error> {
  return { isOk: () => true, value: undefined } as unknown as Result<
    void,
    Error
  >;
}

export function terminate(pid: number): void {
  process.kill(pid, "SIGTERM");
}

/**
 * process.cwd() is fine in packages -- only process.exit() is disallowed.
 */
export function getProjectRoot(): string {
  return process.cwd();
}
