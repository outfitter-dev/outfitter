/**
 * Drift and filesystem helpers for docs outputs.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { relativeToWorkspace, toPosixPath } from "./path-utils.js";
import type {
  DocsDrift,
  DriftKind,
  ResolvedPackageDocsOptions,
} from "./types.js";

function sortDrift(drift: DocsDrift[]): DocsDrift[] {
  const kindPriority: Record<DriftKind, number> = {
    changed: 0,
    missing: 1,
    unexpected: 2,
  };

  return drift.sort((a, b) => {
    const byKind = kindPriority[a.kind] - kindPriority[b.kind];
    if (byKind !== 0) {
      return byKind;
    }

    return a.path.localeCompare(b.path);
  });
}

async function listFilesRecursively(rootPath: string): Promise<string[]> {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files: string[] = [];
  const directories = [rootPath];

  while (directories.length > 0) {
    const currentDir = directories.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        directories.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

export async function pruneEmptyDirectories(rootPath: string): Promise<void> {
  if (!existsSync(rootPath)) {
    return;
  }

  async function prune(currentDir: string): Promise<boolean> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    let hasFiles = false;

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const childHasFiles = await prune(fullPath);
        if (childHasFiles) {
          hasFiles = true;
        } else {
          await rm(fullPath, { recursive: true, force: true });
        }
      } else {
        hasFiles = true;
      }
    }

    return hasFiles;
  }

  await prune(rootPath);
}

export async function removeUnexpectedFiles(input: {
  outputRoot: string;
  expectedPaths: ReadonlySet<string>;
}): Promise<string[]> {
  const existingFiles = await listFilesRecursively(input.outputRoot);
  const unexpectedFiles = existingFiles.filter(
    (existingPath) => !input.expectedPaths.has(existingPath)
  );

  for (const filePath of unexpectedFiles) {
    await rm(filePath, { force: true });
  }

  return unexpectedFiles;
}

export async function computeExplicitFileDrift(
  workspaceRoot: string,
  expectedFiles: ReadonlyMap<string, string>
): Promise<DocsDrift[]> {
  const drift: DocsDrift[] = [];
  const expectedEntries = [...expectedFiles.entries()].sort(([a], [b]) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );

  for (const [expectedPath, expectedContent] of expectedEntries) {
    if (!existsSync(expectedPath)) {
      drift.push({
        kind: "missing",
        path: relativeToWorkspace(workspaceRoot, expectedPath),
      });
      continue;
    }

    const existingContent = await readFile(expectedPath, "utf8");
    if (existingContent !== expectedContent) {
      drift.push({
        kind: "changed",
        path: relativeToWorkspace(workspaceRoot, expectedPath),
      });
    }
  }

  return sortDrift(drift);
}

export async function computeDrift(
  options: ResolvedPackageDocsOptions,
  expectedFiles: ReadonlyMap<string, string>
): Promise<DocsDrift[]> {
  const expectedPaths = new Set(expectedFiles.keys());
  const existingFiles = await listFilesRecursively(options.outputRoot);
  const drift: DocsDrift[] = [];

  const expectedEntries = [...expectedFiles.entries()].sort(([a], [b]) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );

  for (const [expectedPath, expectedContent] of expectedEntries) {
    if (!existsSync(expectedPath)) {
      drift.push({
        kind: "missing",
        path: relativeToWorkspace(options.workspaceRoot, expectedPath),
      });
      continue;
    }

    const existingContent = await readFile(expectedPath, "utf8");
    if (existingContent !== expectedContent) {
      drift.push({
        kind: "changed",
        path: relativeToWorkspace(options.workspaceRoot, expectedPath),
      });
    }
  }

  for (const existingPath of existingFiles) {
    if (expectedPaths.has(existingPath)) {
      continue;
    }

    drift.push({
      kind: "unexpected",
      path: relativeToWorkspace(options.workspaceRoot, existingPath),
    });
  }

  return sortDrift(drift);
}
