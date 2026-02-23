/**
 * Path helpers for docs-core modules.
 *
 * @packageDocumentation
 */

import { isAbsolute, relative } from "node:path";

export function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

export function relativeToWorkspace(
  workspaceRoot: string,
  absolutePath: string
): string {
  return toPosixPath(relative(workspaceRoot, absolutePath));
}

export function isPathInsideWorkspace(
  workspaceRoot: string,
  absolutePath: string
): boolean {
  const rel = relative(workspaceRoot, absolutePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

export function isSamePathOrDescendant(
  parentPath: string,
  candidatePath: string
): boolean {
  const rel = relative(parentPath, candidatePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

export function pathsOverlap(pathA: string, pathB: string): boolean {
  return (
    isSamePathOrDescendant(pathA, pathB) || isSamePathOrDescendant(pathB, pathA)
  );
}
