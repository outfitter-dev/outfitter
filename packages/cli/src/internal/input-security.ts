/**
 * Path and glob security validation for CLI input.
 *
 * @internal
 */

import path from "node:path";

/**
 * Validates that a path doesn't contain traversal patterns.
 *
 * Rejects paths that:
 * - Start with .. or contain /.. or \..
 * - Contain null bytes
 * - Are absolute paths (unless explicitly allowed)
 */
export function isSecurePath(filePath: string, allowAbsolute = false): boolean {
  // Reject null bytes
  if (filePath.includes("\0")) {
    return false;
  }

  // Check for .. traversal in ORIGINAL path (before normalization collapses it)
  // This catches both "../../../etc/passwd" and "/tmp/../../../etc/passwd"
  if (filePath.includes("..")) {
    return false;
  }

  // Normalize to handle different separators for absolute path check
  const normalized = path.normalize(filePath);

  // Reject absolute paths unless explicitly allowed
  if (!allowAbsolute && path.isAbsolute(normalized)) {
    return false;
  }

  return true;
}

/**
 * Validates that a glob pattern doesn't escape the workspace.
 *
 * Rejects patterns that:
 * - Start with ..
 * - Contain /../
 */
export function isSecureGlobPattern(pattern: string): boolean {
  // Reject patterns that start with ..
  if (pattern.startsWith("..")) {
    return false;
  }

  // Reject patterns containing /../
  if (pattern.includes("/../")) {
    return false;
  }

  return true;
}

/**
 * Validates that a resolved path is within the workspace boundary.
 */
export function isWithinWorkspace(
  resolvedPath: string,
  workspaceRoot: string
): boolean {
  const normalizedPath = path.normalize(resolvedPath);
  const normalizedRoot = path.normalize(workspaceRoot);

  // Ensure the path starts with the workspace root
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(normalizedRoot + path.sep)
  );
}
