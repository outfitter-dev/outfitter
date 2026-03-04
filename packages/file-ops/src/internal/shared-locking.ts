import { writeFile as fsWriteFile, unlink } from "node:fs/promises";

import { ConflictError, InternalError, Result } from "@outfitter/contracts";

import { acquireLock, releaseLock } from "./locking.js";
import type {
  LockData,
  LockOptions,
  SharedFileLock,
  SharedLockData,
  SharedLockReader,
} from "./types.js";

/**
 * Acquires a shared (reader) lock on a file.
 *
 * Multiple readers can hold shared locks simultaneously. Shared locks are
 * blocked by exclusive locks. Uses the same .lock file as exclusive locks
 * with a JSON format that distinguishes lock types.
 *
 * Important: This is advisory locking. All processes must cooperate by using
 * these locking APIs. The filesystem does not enforce the lock.
 *
 * @param path - Absolute path to the file to lock
 * @param options - Lock options including timeout and retry interval
 * @returns Result containing SharedFileLock on success, or ConflictError if blocked by exclusive lock
 */
export async function acquireSharedLock(
  path: string,
  options?: LockOptions
): Promise<Result<SharedFileLock, InstanceType<typeof ConflictError>>> {
  const lockPath = `${path}.lock`;
  const metaLockPath = `${lockPath}.meta`;
  const startTime = Date.now();
  const timeout = options?.timeout ?? 0;
  const retryInterval = options?.retryInterval ?? 50;

  while (true) {
    // Acquire meta-lock to protect read-modify-write sequence
    const metaLockResult = await acquireLock(metaLockPath, {
      timeout: retryInterval,
      retryInterval: 10,
    });

    if (metaLockResult.isErr()) {
      // Meta-lock busy - retry
      if (timeout > 0 && Date.now() - startTime < timeout) {
        await Bun.sleep(retryInterval);
        continue;
      }
      return Result.err(
        new ConflictError({
          message: `Failed to acquire shared lock: ${path}`,
        })
      );
    }

    const metaLock = metaLockResult.value;

    const lockFile = Bun.file(lockPath);
    const exists = await lockFile.exists();

    if (exists) {
      // Read existing lock file
      try {
        const lockContent = await lockFile.text();
        const lockData = JSON.parse(lockContent) as LockData;

        if (lockData.type === "exclusive") {
          // Exclusive lock exists - cannot acquire shared lock
          await releaseLock(metaLock);
          if (timeout > 0 && Date.now() - startTime < timeout) {
            await Bun.sleep(retryInterval);
            continue;
          }
          return Result.err(
            new ConflictError({
              message: `File is exclusively locked: ${path}`,
            })
          );
        }

        // Shared lock exists - add ourselves as a reader
        const readerId = Bun.randomUUIDv7();
        const newReader: SharedLockReader = {
          id: readerId,
          pid: process.pid,
          timestamp: Date.now(),
        };
        lockData.readers.push(newReader);

        // Write updated lock file
        await fsWriteFile(lockPath, JSON.stringify(lockData));
        await releaseLock(metaLock);

        return Result.ok({
          path,
          lockPath,
          pid: process.pid,
          timestamp: newReader.timestamp,
          lockType: "shared" as const,
          readerId,
        });
      } catch {
        // Lock file exists but couldn't be parsed - treat as exclusive
        await releaseLock(metaLock);
        if (timeout > 0 && Date.now() - startTime < timeout) {
          await Bun.sleep(retryInterval);
          continue;
        }
        return Result.err(
          new ConflictError({
            message: `File is locked: ${path}`,
          })
        );
      }
    }

    // No lock file exists - create new shared lock
    const readerId = Bun.randomUUIDv7();
    const timestamp = Date.now();
    const sharedLockData: SharedLockData = {
      type: "shared",
      readers: [
        {
          id: readerId,
          pid: process.pid,
          timestamp,
        },
      ],
    };

    try {
      await fsWriteFile(lockPath, JSON.stringify(sharedLockData), {
        flag: "wx",
      });
      await releaseLock(metaLock);

      return Result.ok({
        path,
        lockPath,
        pid: process.pid,
        timestamp,
        lockType: "shared" as const,
        readerId,
      });
    } catch (error) {
      await releaseLock(metaLock);
      // File already exists (race condition) - retry
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST" &&
        timeout > 0 &&
        Date.now() - startTime < timeout
      ) {
        await Bun.sleep(retryInterval);
        continue;
      }
      return Result.err(
        new ConflictError({
          message: `Failed to acquire shared lock: ${path}`,
        })
      );
    }
  }
}

/**
 * Releases a shared (reader) lock.
 *
 * Removes this process from the list of readers in the lock file.
 * If this is the last reader, the lock file is deleted.
 *
 * @param lock - Shared lock object returned from acquireSharedLock
 * @returns Result indicating success, or InternalError if lock file cannot be modified
 */
export async function releaseSharedLock(
  lock: SharedFileLock
): Promise<Result<void, InstanceType<typeof InternalError>>> {
  const metaLockPath = `${lock.lockPath}.meta`;

  // Acquire meta-lock to protect read-modify-write sequence
  const metaLockResult = await acquireLock(metaLockPath, {
    timeout: 5000,
    retryInterval: 10,
  });

  if (metaLockResult.isErr()) {
    return Result.err(
      new InternalError({
        message: "Failed to acquire meta-lock for shared lock release",
      })
    );
  }

  const metaLock = metaLockResult.value;

  try {
    const lockFile = Bun.file(lock.lockPath);
    const exists = await lockFile.exists();

    if (!exists) {
      // Lock file already gone - consider it released
      await releaseLock(metaLock);
      return Result.ok(undefined);
    }

    const lockContent = await lockFile.text();
    const lockData = JSON.parse(lockContent) as LockData;

    if (lockData.type !== "shared") {
      // Not a shared lock - this shouldn't happen
      await releaseLock(metaLock);
      return Result.err(
        new InternalError({
          message: "Lock file is not a shared lock",
        })
      );
    }

    // Remove this reader from the list (match by unique readerId)
    lockData.readers = lockData.readers.filter(
      (reader) => reader.id !== lock.readerId
    );

    if (lockData.readers.length === 0) {
      // Last reader - delete lock file
      await unlink(lock.lockPath);
    } else {
      // Other readers remain - update lock file
      await fsWriteFile(lock.lockPath, JSON.stringify(lockData));
    }

    await releaseLock(metaLock);
    return Result.ok(undefined);
  } catch (error) {
    await releaseLock(metaLock);
    return Result.err(
      new InternalError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to release shared lock",
      })
    );
  }
}

/**
 * Executes a callback while holding a shared (reader) lock on a file.
 *
 * Lock is automatically released after callback completes, whether it
 * succeeds or throws an error. This is the recommended way to use shared locks.
 *
 * Multiple readers can hold shared locks simultaneously. Use this for
 * read-only operations that should not block other readers.
 *
 * @typeParam T - Return type of the callback
 * @param path - Absolute path to the file to lock
 * @param callback - Async callback to execute while holding lock
 * @param options - Lock options including timeout and retry interval
 * @returns Result containing callback return value, ConflictError if blocked, or InternalError on failure
 */
export async function withSharedLock<T>(
  path: string,
  callback: () => Promise<T>,
  options?: LockOptions
): Promise<
  Result<
    T,
    InstanceType<typeof ConflictError> | InstanceType<typeof InternalError>
  >
> {
  const lockResult = await acquireSharedLock(path, options);

  if (lockResult.isErr()) {
    return lockResult;
  }

  const lock = lockResult.value;

  try {
    const result = await callback();
    const releaseResult = await releaseSharedLock(lock);
    // Surface release failures to caller
    if (releaseResult.isErr()) {
      return releaseResult;
    }
    return Result.ok(result);
  } catch (error) {
    // Always attempt to release the lock, even on error
    const releaseResult = await releaseSharedLock(lock);
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
