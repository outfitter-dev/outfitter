import { writeFile as fsWriteFile, unlink } from "node:fs/promises";

import { ConflictError, InternalError, Result } from "@outfitter/contracts";

import type {
  ExclusiveLockData,
  FileLock,
  LockData,
  LockOptions,
} from "./types.js";

/**
 * Acquires an exclusive advisory lock on a file.
 *
 * Creates a .lock file next to the target file with lock metadata (PID, timestamp).
 * Uses atomic file creation (wx flag) to prevent race conditions.
 *
 * Exclusive locks block and are blocked by both shared and exclusive locks.
 * Use shared locks (acquireSharedLock) for read-only operations.
 *
 * Important: This is advisory locking. All processes must cooperate by using
 * these locking APIs. The filesystem does not enforce the lock.
 *
 * Prefer using withLock for automatic lock release.
 *
 * @param path - Absolute path to the file to lock
 * @param options - Lock options including timeout and retry interval
 * @returns Result containing FileLock on success, or ConflictError if already locked
 */
export async function acquireLock(
  path: string,
  options?: LockOptions
): Promise<Result<FileLock, InstanceType<typeof ConflictError>>> {
  const lockPath = `${path}.lock`;
  const startTime = Date.now();
  const timeout = options?.timeout ?? 0;
  const retryInterval = options?.retryInterval ?? 50;

  while (true) {
    // Check if lock file already exists
    const lockFile = Bun.file(lockPath);
    if (await lockFile.exists()) {
      // Check if it's a shared lock or exclusive lock
      try {
        const lockContent = await lockFile.text();
        const lockData = JSON.parse(lockContent) as LockData;

        // Block on both shared and exclusive locks
        if (lockData.type === "shared" && lockData.readers.length > 0) {
          if (timeout > 0 && Date.now() - startTime < timeout) {
            await Bun.sleep(retryInterval);
            continue;
          }
          return Result.err(
            new ConflictError({
              message: `File has shared locks: ${path}`,
            })
          );
        }
      } catch {
        // Couldn't parse as new format - treat as legacy exclusive lock
      }

      if (timeout > 0 && Date.now() - startTime < timeout) {
        await Bun.sleep(retryInterval);
        continue;
      }
      return Result.err(
        new ConflictError({
          message: `File is already locked: ${path}`,
        })
      );
    }

    const lock: FileLock = {
      path,
      lockPath,
      pid: process.pid,
      timestamp: Date.now(),
    };

    // Create lock file with exclusive lock information
    const exclusiveLockData: ExclusiveLockData = {
      type: "exclusive",
      pid: lock.pid,
      timestamp: lock.timestamp,
    };

    try {
      await fsWriteFile(lockPath, JSON.stringify(exclusiveLockData), {
        flag: "wx",
      }); // Fail if file exists (atomic check-and-create)
    } catch (error) {
      // If file already exists (race condition), retry or return conflict error
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        if (timeout > 0 && Date.now() - startTime < timeout) {
          await Bun.sleep(retryInterval);
          continue;
        }
        return Result.err(
          new ConflictError({
            message: `File is already locked: ${path}`,
          })
        );
      }
      // eslint-disable-next-line outfitter/no-throw-in-handler -- rethrow unexpected error after handling known conflict case
      throw error;
    }

    return Result.ok(lock);
  }
}

/**
 * Releases a file lock by removing the .lock file.
 *
 * Should only be called with a lock obtained from acquireLock.
 * Prefer using withLock for automatic lock management.
 *
 * @param lock - Lock object returned from acquireLock
 * @returns Result indicating success, or InternalError if lock file cannot be removed
 */
export async function releaseLock(
  lock: FileLock
): Promise<Result<void, InstanceType<typeof InternalError>>> {
  try {
    await unlink(lock.lockPath);
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Failed to release lock",
      })
    );
  }
}

/**
 * Executes a callback while holding an exclusive lock on a file.
 *
 * Lock is automatically released after callback completes, whether it
 * succeeds or throws an error. This is the recommended way to use file locking.
 *
 * Uses advisory file locking via .lock files. The lock is NOT enforced
 * by the filesystem - all processes must cooperate by using this API.
 *
 * @typeParam T - Return type of the callback
 * @param path - Absolute path to the file to lock
 * @param callback - Async callback to execute while holding lock
 * @returns Result containing callback return value, ConflictError if locked, or InternalError on failure
 */
export async function withLock<T>(
  path: string,
  callback: () => Promise<T>
): Promise<
  Result<
    T,
    InstanceType<typeof ConflictError> | InstanceType<typeof InternalError>
  >
> {
  const lockResult = await acquireLock(path);

  if (lockResult.isErr()) {
    return lockResult;
  }

  const lock = lockResult.value;

  try {
    const result = await callback();
    const releaseResult = await releaseLock(lock);
    // Surface release failures to caller
    if (releaseResult.isErr()) {
      return releaseResult;
    }
    return Result.ok(result);
  } catch (error) {
    // Always attempt to release the lock, even on error
    const releaseResult = await releaseLock(lock);
    // If release also fails, include that in the error
    if (releaseResult.isErr()) {
      return Result.err(
        new InternalError({
          message: `Callback failed: ${error instanceof Error ? error.message : "Unknown error"}; lock release also failed: ${releaseResult.error.message}`,
        })
      );
    }
    return Result.err(
      new InternalError({
        message: error instanceof Error ? error.message : "Callback failed",
      })
    );
  }
}

/**
 * Checks if a file is currently locked.
 *
 * Checks for the existence of a .lock file. Does not verify if the
 * process holding the lock is still running (no stale lock detection).
 *
 * @param path - Absolute path to check
 * @returns True if a lock file exists, false otherwise
 */
export function isLocked(path: string): Promise<boolean> {
  const lockPath = `${path}.lock`;
  return Bun.file(lockPath).exists();
}
