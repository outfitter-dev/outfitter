/**
 * Daemon locking utilities.
 *
 * Provides PID-based locking for daemon lifecycle management,
 * including stale lock detection and process liveness checks.
 *
 * @packageDocumentation
 */

import { unlink } from "node:fs/promises";
import type { Result } from "@outfitter/contracts";
import { LockError } from "./errors.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Handle returned when a lock is successfully acquired.
 *
 * Must be passed to `releaseDaemonLock` to properly release the lock.
 */
export interface LockHandle {
  /** Path to the lock file */
  readonly lockPath: string;

  /** PID that owns the lock */
  readonly pid: number;
}

// ============================================================================
// Process Liveness
// ============================================================================

/**
 * Check if a process with the given PID is alive.
 *
 * Uses `process.kill(pid, 0)` which sends no signal but checks
 * if the process exists and is accessible.
 *
 * @param pid - Process ID to check
 * @returns true if process exists and is accessible, false otherwise
 *
 * @example
 * ```typescript
 * if (isProcessAlive(12345)) {
 *   console.log("Process is still running");
 * } else {
 *   console.log("Process has exited");
 * }
 * ```
 */
export function isProcessAlive(pid: number): boolean {
  // Negative PIDs are invalid - they have special meaning in kill()
  if (pid <= 0) {
    return false;
  }

  try {
    // Signal 0 doesn't kill, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = no such process, EPERM = exists but no permission
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      return true;
    }
    return false;
  }
}

/**
 * Check if a daemon is alive by reading its lock file.
 *
 * @param lockPath - Path to the daemon lock file
 * @returns true if lock file exists and process is alive, false otherwise
 *
 * @example
 * ```typescript
 * const alive = await isDaemonAlive("/run/user/1000/waymark/daemon.lock");
 * if (!alive) {
 *   // Safe to start a new daemon
 * }
 * ```
 */
export async function isDaemonAlive(lockPath: string): Promise<boolean> {
  const file = Bun.file(lockPath);

  if (!(await file.exists())) {
    return false;
  }

  try {
    const content = await file.text();
    const pid = Number.parseInt(content.trim(), 10);

    if (Number.isNaN(pid)) {
      // Invalid lock file content
      return false;
    }

    return isProcessAlive(pid);
  } catch {
    // Error reading file
    return false;
  }
}

// ============================================================================
// Lock Acquisition
// ============================================================================

/**
 * Acquire an exclusive lock for a daemon.
 *
 * Uses a PID file approach compatible with Bun:
 * 1. Check if lock file exists with a valid PID
 * 2. If PID is alive, refuse (daemon already running)
 * 3. If PID is stale or no lock, write our PID atomically
 *
 * @param lockPath - Path to create the lock file
 * @returns Result with LockHandle on success, LockError on failure
 *
 * @example
 * ```typescript
 * const result = await acquireDaemonLock("/run/user/1000/waymark/daemon.lock");
 *
 * if (result.isOk()) {
 *   console.log(`Lock acquired for PID ${result.value.pid}`);
 *   // ... run daemon ...
 *   await releaseDaemonLock(result.value);
 * } else {
 *   console.error(`Failed to acquire lock: ${result.error.message}`);
 * }
 * ```
 */
export async function acquireDaemonLock(
  lockPath: string
): Promise<Result<LockHandle, LockError>> {
  const file = Bun.file(lockPath);

  // Check if lock file exists with a valid PID
  if (await file.exists()) {
    try {
      const content = await file.text();
      const existingPid = Number.parseInt(content.trim(), 10);

      if (!Number.isNaN(existingPid) && isProcessAlive(existingPid)) {
        return {
          isOk: () => false,
          isErr: () => true,
          error: new LockError({
            message: `Daemon already running with PID ${existingPid}`,
            lockPath,
            pid: existingPid,
          }),
        } as Result<LockHandle, LockError>;
      }
      // Stale lock file - process no longer exists, continue to acquire
    } catch {
      // Error reading file, try to acquire anyway
    }
  }

  // Write our PID atomically
  const pid = process.pid;

  try {
    await Bun.write(lockPath, `${pid}\n`);

    return {
      isOk: () => true,
      isErr: () => false,
      value: { lockPath, pid },
    } as Result<LockHandle, LockError>;
  } catch (error) {
    return {
      isOk: () => false,
      isErr: () => true,
      error: new LockError({
        message: `Failed to write lock file: ${error instanceof Error ? error.message : String(error)}`,
        lockPath,
        pid,
      }),
    } as Result<LockHandle, LockError>;
  }
}

/**
 * Release a daemon lock.
 *
 * Removes the lock file only if the PID inside matches the handle.
 * This prevents accidentally removing a lock acquired by another process.
 *
 * @param handle - Lock handle returned from acquireDaemonLock
 *
 * @example
 * ```typescript
 * const result = await acquireDaemonLock(lockPath);
 * if (result.isOk()) {
 *   try {
 *     // ... run daemon ...
 *   } finally {
 *     await releaseDaemonLock(result.value);
 *   }
 * }
 * ```
 */
export async function releaseDaemonLock(handle: LockHandle): Promise<void> {
  const { lockPath, pid } = handle;
  const file = Bun.file(lockPath);

  if (!(await file.exists())) {
    // Lock file already removed, nothing to do
    return;
  }

  try {
    const content = await file.text();
    const filePid = Number.parseInt(content.trim(), 10);

    // Only remove if PID matches (our lock)
    if (filePid === pid) {
      await unlink(lockPath);
    }
  } catch {
    // Best effort - if we can't release, just return
  }
}

/**
 * Read the PID from a lock file.
 *
 * @param lockPath - Path to the lock file
 * @returns The PID if valid, undefined otherwise
 *
 * @internal
 */
export async function readLockPid(
  lockPath: string
): Promise<number | undefined> {
  const file = Bun.file(lockPath);

  if (!(await file.exists())) {
    return undefined;
  }

  try {
    const content = await file.text();
    const pid = Number.parseInt(content.trim(), 10);
    return Number.isNaN(pid) ? undefined : pid;
  } catch {
    return undefined;
  }
}
