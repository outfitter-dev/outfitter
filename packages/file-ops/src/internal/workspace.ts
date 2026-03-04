import { stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { NotFoundError, Result } from "@outfitter/contracts";

import type { FindWorkspaceRootOptions } from "./types.js";

/**
 * Checks if a marker exists at the given directory.
 */
async function markerExistsAt(dir: string, marker: string): Promise<boolean> {
  try {
    const markerPath = join(dir, marker);
    await stat(markerPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the workspace root by searching upward for marker files/directories.
 *
 * Searches from startPath up to the filesystem root (or stopAt if specified),
 * returning the first directory containing any of the marker files.
 * Default markers are ".git" and "package.json".
 *
 * @param startPath - Path to start searching from (can be file or directory)
 * @param options - Search options including custom markers and stop boundary
 * @returns Result containing absolute workspace root path, or NotFoundError if no markers found
 */
export async function findWorkspaceRoot(
  startPath: string,
  options?: FindWorkspaceRootOptions
): Promise<Result<string, InstanceType<typeof NotFoundError>>> {
  const markers = options?.markers ?? [".git", "package.json"];
  const stopAt = options?.stopAt;

  let currentDir = resolve(startPath);
  const root = resolve("/");

  while (true) {
    // Check for any marker at this level
    for (const marker of markers) {
      if (await markerExistsAt(currentDir, marker)) {
        return Result.ok(currentDir);
      }
    }

    // Check if we've hit the stop boundary
    if (stopAt && currentDir === resolve(stopAt)) {
      break;
    }

    // Check if we've hit the filesystem root
    if (currentDir === root) {
      break;
    }

    // Move up one directory
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root, no more parents
      break;
    }
    currentDir = parentDir;
  }

  return Result.err(
    new NotFoundError({
      message: "No workspace root found",
      resourceType: "workspace",
      resourceId: startPath,
    })
  );
}

/**
 * Gets the path relative to the workspace root.
 *
 * Finds the workspace root from the file's directory and returns the
 * path relative to that root. Uses forward slashes for cross-platform consistency.
 *
 * @param absolutePath - Absolute path to convert to workspace-relative
 * @returns Result containing relative path with forward slashes, or NotFoundError if no workspace found
 */
export async function getRelativePath(
  absolutePath: string
): Promise<Result<string, InstanceType<typeof NotFoundError>>> {
  const workspaceResult = await findWorkspaceRoot(dirname(absolutePath));

  if (workspaceResult.isErr()) {
    return workspaceResult;
  }

  const relativePath = relative(workspaceResult.value, absolutePath);
  // Normalize to forward slashes for consistency
  return Result.ok(relativePath.split(sep).join("/"));
}

/**
 * Checks if a path is inside a workspace directory.
 *
 * Resolves both paths to absolute form and checks if path is equal to
 * or a descendant of workspaceRoot. Does not follow symlinks.
 *
 * @param path - Path to check (can be relative or absolute)
 * @param workspaceRoot - Workspace root directory to check against
 * @returns True if path is inside or equal to workspace root, false otherwise
 */
export function isInsideWorkspace(
  path: string,
  workspaceRoot: string
): boolean {
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(workspaceRoot);

  // Check if the resolved path starts with the workspace root
  return (
    resolvedPath.startsWith(resolvedRoot + sep) || resolvedPath === resolvedRoot
  );
}
