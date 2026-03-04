import { isAbsolute, join, normalize, sep } from "node:path";

import { Result, ValidationError } from "@outfitter/contracts";

/**
 * Validates and secures a user-provided path, preventing path traversal attacks.
 *
 * Security checks performed:
 * - Null bytes are rejected immediately
 * - Path traversal sequences (..) are rejected
 * - Absolute paths are rejected
 * - Final resolved path is verified to remain within basePath (defense in depth)
 *
 * Always use this function when handling user-provided paths instead of
 * directly using path.join with untrusted input.
 *
 * @param path - User-provided path to validate (must be relative)
 * @param basePath - Base directory to resolve against
 * @returns Result containing resolved absolute safe path, or ValidationError if path is unsafe
 */
export function securePath(
  path: string,
  basePath: string
): Result<string, InstanceType<typeof ValidationError>> {
  // Check for null bytes
  if (path.includes("\x00")) {
    return Result.err(
      new ValidationError({
        message: "Path contains null bytes",
        field: "path",
      })
    );
  }

  // Normalize backslashes to forward slashes
  const normalizedPath = path.replace(/\\/g, "/");

  // Check for path traversal
  if (normalizedPath.includes("..")) {
    return Result.err(
      new ValidationError({
        message: "Path contains traversal sequence",
        field: "path",
      })
    );
  }

  // Check for absolute paths
  if (normalizedPath.startsWith("/")) {
    return Result.err(
      new ValidationError({
        message: "Absolute paths are not allowed",
        field: "path",
      })
    );
  }

  // Remove leading ./ if present
  const cleanPath = normalizedPath.replace(/^\.\//, "");

  // Resolve the final path
  const resolvedPath = join(basePath, cleanPath);

  // Double-check the resolved path is within basePath (defense in depth)
  const normalizedResolved = normalize(resolvedPath);
  const normalizedBase = normalize(basePath);

  if (!normalizedResolved.startsWith(normalizedBase)) {
    return Result.err(
      new ValidationError({
        message: "Path escapes base directory",
        field: "path",
      })
    );
  }

  return Result.ok(resolvedPath);
}

/**
 * Checks if a path is safe (no traversal, valid characters).
 *
 * Convenience wrapper around securePath that returns a boolean.
 * Use this for quick validation; use securePath when you need the resolved path.
 *
 * @param path - Path to check (should be relative)
 * @param basePath - Base directory to resolve against
 * @returns True if path passes all security checks, false otherwise
 */
export function isPathSafe(path: string, basePath: string): boolean {
  return Result.isOk(securePath(path, basePath));
}

/**
 * Safely resolves path segments into an absolute path.
 *
 * Validates each segment for security issues before joining. Use this
 * instead of path.join when any segment may come from user input.
 *
 * Security checks per segment:
 * - Null bytes are rejected
 * - Path traversal (..) is rejected
 * - Absolute path segments are rejected
 *
 * @param basePath - Base directory (must be absolute)
 * @param segments - Path segments to join (each validated individually)
 * @returns Result containing resolved absolute path, or ValidationError if any segment is unsafe
 */
export function resolveSafePath(
  basePath: string,
  ...segments: string[]
): Result<string, InstanceType<typeof ValidationError>> {
  // Check each segment for security issues
  for (const segment of segments) {
    // Check for null bytes
    if (segment.includes("\x00")) {
      return Result.err(
        new ValidationError({
          message: "Path segment contains null bytes",
          field: "path",
        })
      );
    }

    // Check for path traversal
    if (segment.includes("..")) {
      return Result.err(
        new ValidationError({
          message: "Path segment contains traversal sequence",
          field: "path",
        })
      );
    }

    // Block absolute segments to prevent path escapes
    if (isAbsolute(segment)) {
      return Result.err(
        new ValidationError({
          message: "Absolute path segments are not allowed",
          field: "path",
        })
      );
    }
  }

  // Join all segments
  const resolvedPath = join(basePath, ...segments);

  // Verify the resolved path is within basePath using path-boundary check
  const normalizedResolved = normalize(resolvedPath);
  const normalizedBase = normalize(basePath);

  // Use path-boundary check: must equal base or start with base + separator
  if (
    normalizedResolved !== normalizedBase &&
    !normalizedResolved.startsWith(normalizedBase + sep)
  ) {
    return Result.err(
      new ValidationError({
        message: "Path escapes base directory",
        field: "path",
      })
    );
  }

  return Result.ok(resolvedPath);
}
