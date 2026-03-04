import {
  writeFile as fsWriteFile,
  mkdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";

import { InternalError, Result, ValidationError } from "@outfitter/contracts";

import type { AtomicWriteOptions } from "./types.js";

/**
 * Writes content to a file atomically using temp-file-then-rename strategy.
 *
 * How it works:
 * 1. Creates a unique temp file in the same directory
 * 2. Writes content to temp file
 * 3. Renames temp file to target (atomic on most filesystems)
 * 4. Cleans up temp file on failure
 *
 * This prevents partial writes and file corruption. The file either
 * contains the old content or the new content, never a partial state.
 *
 * @param path - Absolute path to target file
 * @param content - String content to write
 * @param options - Write options including directory creation and permission handling
 * @returns Result indicating success, or InternalError on failure
 */
export async function atomicWrite(
  path: string,
  content: string,
  options?: AtomicWriteOptions
): Promise<Result<void, InstanceType<typeof InternalError>>> {
  const createParentDirs = options?.createParentDirs ?? true;
  const parentDir = dirname(path);
  // Add random suffix for uniqueness in concurrent writes
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const tempPath = `${path}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;

  try {
    // Create parent directories if needed
    if (createParentDirs) {
      await mkdir(parentDir, { recursive: true });
    }

    // Get existing file permissions if needed
    let mode = options?.mode ?? 0o644;
    if (options?.preservePermissions) {
      try {
        const stats = await stat(path);
        mode = stats.mode;
      } catch {
        // File doesn't exist, use default mode
      }
    }

    // Write to temp file
    await fsWriteFile(tempPath, content, { mode });

    // Rename temp file to target (atomic operation on most filesystems)
    await rename(tempPath, path);

    return Result.ok(undefined);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    return Result.err(
      new InternalError({
        message: error instanceof Error ? error.message : "Atomic write failed",
      })
    );
  }
}

/**
 * Writes JSON data to a file atomically.
 *
 * Serializes data to JSON and writes using atomicWrite.
 * Returns ValidationError if serialization fails.
 *
 * @typeParam T - Type of data to serialize
 * @param path - Absolute path to target file
 * @param data - Data to serialize and write (must be JSON-serializable)
 * @param options - Write options including directory creation and permission handling
 * @returns Result indicating success, ValidationError if serialization fails, or InternalError on write failure
 */
export async function atomicWriteJson<T>(
  path: string,
  data: T,
  options?: AtomicWriteOptions
): Promise<
  Result<
    void,
    InstanceType<typeof InternalError> | InstanceType<typeof ValidationError>
  >
> {
  try {
    const content = JSON.stringify(data);
    return await atomicWrite(path, content, options);
  } catch (error) {
    return Result.err(
      new ValidationError({
        message:
          error instanceof Error ? error.message : "Failed to serialize JSON",
        field: "data",
      })
    );
  }
}
