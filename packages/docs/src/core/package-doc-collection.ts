/**
 * Shared package docs source discovery and output path planning.
 *
 * This module centralizes package discovery, markdown file collection,
 * and output-path normalization/collision detection used by both docs-map
 * generation and package docs sync/check flows.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { Result } from "better-result";
import {
  isPathInsideWorkspace,
  relativeToWorkspace,
  toPosixPath,
} from "./path-utils.js";

interface DiscoveredPackage {
  readonly packageDirName: string;
  readonly packageRoot: string;
}

export interface CollectedPackageDocFile {
  readonly destinationAbsolutePath: string;
  readonly outputPath: string;
  readonly packageName: string;
  readonly relativeFromPackageRoot: string;
  readonly sourceAbsolutePath: string;
  readonly sourcePath: string;
}

export interface CollectPackageDocsSuccess {
  readonly files: readonly CollectedPackageDocFile[];
  readonly packageNames: readonly string[];
}

export type CollectPackageDocsError =
  | {
      readonly kind: "outputPathOutsideWorkspace";
      readonly outputAbsolutePath: string;
      readonly sourcePath: string;
    }
  | {
      readonly kind: "outputPathCollision";
      readonly collisionSourcePath: string;
      readonly firstSourceAbsolutePath: string;
      readonly outputPath: string;
      readonly secondSourceAbsolutePath: string;
      readonly sourcePath: string;
    };

export interface CollectPackageDocsOptions {
  readonly excludedLowercaseNames: ReadonlySet<string>;
  readonly outputRoot: string;
  readonly packagesRoot: string;
  readonly workspaceRoot: string;
}

function toOutputRelativePath(relativePath: string): string {
  const extension = extname(relativePath).toLowerCase();
  if (extension !== ".mdx") {
    return relativePath;
  }

  return `${relativePath.slice(0, -".mdx".length)}.md`;
}

async function discoverPackageDirectories(
  packagesRoot: string
): Promise<DiscoveredPackage[]> {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      packageDirName: entry.name,
      packageRoot: join(packagesRoot, entry.name),
    }))
    .sort((a, b) => a.packageDirName.localeCompare(b.packageDirName));
}

async function isPublishablePackage(packageRoot: string): Promise<boolean> {
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(content) as { private?: boolean };
    return parsed.private !== true;
  } catch {
    return false;
  }
}

function isDocsSourceFile(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return extension === ".md" || extension === ".mdx";
}

function isExcludedFileName(
  path: string,
  excludedLowercaseNames: ReadonlySet<string>
): boolean {
  const fileName = path.split(/[\\/]/).at(-1) ?? "";
  return excludedLowercaseNames.has(fileName.toLowerCase());
}

async function collectDocsSubtreeSourceFiles(
  docsRoot: string,
  excludedLowercaseNames: ReadonlySet<string>
): Promise<string[]> {
  if (!existsSync(docsRoot)) {
    return [];
  }

  const files: string[] = [];
  const directories = [docsRoot];

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
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isDocsSourceFile(entry.name)) {
        continue;
      }

      if (isExcludedFileName(entry.name, excludedLowercaseNames)) {
        continue;
      }

      files.push(fullPath);
    }
  }

  return files.sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

async function collectPackageSourceFiles(
  packageRoot: string,
  excludedLowercaseNames: ReadonlySet<string>
): Promise<string[]> {
  const rootEntries = await readdir(packageRoot, { withFileTypes: true });

  const rootDocsFiles = rootEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((entryName) => isDocsSourceFile(entryName))
    .filter(
      (entryName) => !isExcludedFileName(entryName, excludedLowercaseNames)
    )
    .map((entryName) => join(packageRoot, entryName));

  const docsSubtreeDocsFiles = await collectDocsSubtreeSourceFiles(
    join(packageRoot, "docs"),
    excludedLowercaseNames
  );

  return [...rootDocsFiles, ...docsSubtreeDocsFiles].sort((a, b) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );
}

export async function collectPackageDocs(
  options: CollectPackageDocsOptions
): Promise<Result<CollectPackageDocsSuccess, CollectPackageDocsError>> {
  const discoveredPackages = await discoverPackageDirectories(
    options.packagesRoot
  );
  const packageNames: string[] = [];
  const files: CollectedPackageDocFile[] = [];
  const sourceByOutputPath = new Map<string, string>();
  const sourceAbsoluteByOutputPath = new Map<string, string>();

  for (const discoveredPackage of discoveredPackages) {
    const publishable = await isPublishablePackage(
      discoveredPackage.packageRoot
    );
    if (!publishable) {
      continue;
    }

    const markdownFiles = await collectPackageSourceFiles(
      discoveredPackage.packageRoot,
      options.excludedLowercaseNames
    );
    if (markdownFiles.length === 0) {
      continue;
    }

    packageNames.push(discoveredPackage.packageDirName);

    for (const sourceAbsolutePath of markdownFiles) {
      const relativeFromPackageRoot = relative(
        discoveredPackage.packageRoot,
        sourceAbsolutePath
      );
      const sourcePath = relativeToWorkspace(
        options.workspaceRoot,
        sourceAbsolutePath
      );
      const destinationAbsolutePath = resolve(
        options.outputRoot,
        discoveredPackage.packageDirName,
        toOutputRelativePath(relativeFromPackageRoot)
      );

      if (
        !isPathInsideWorkspace(options.workspaceRoot, destinationAbsolutePath)
      ) {
        return Result.err({
          kind: "outputPathOutsideWorkspace",
          sourcePath,
          outputAbsolutePath: destinationAbsolutePath,
        });
      }

      const outputPath = relativeToWorkspace(
        options.workspaceRoot,
        destinationAbsolutePath
      );
      const collisionSourcePath = sourceByOutputPath.get(outputPath);
      if (collisionSourcePath && collisionSourcePath !== sourcePath) {
        return Result.err({
          kind: "outputPathCollision",
          outputPath,
          sourcePath,
          collisionSourcePath,
          firstSourceAbsolutePath:
            sourceAbsoluteByOutputPath.get(outputPath) ?? sourceAbsolutePath,
          secondSourceAbsolutePath: sourceAbsolutePath,
        });
      }

      sourceByOutputPath.set(outputPath, sourcePath);
      sourceAbsoluteByOutputPath.set(outputPath, sourceAbsolutePath);

      files.push({
        packageName: discoveredPackage.packageDirName,
        sourceAbsolutePath,
        sourcePath,
        relativeFromPackageRoot,
        destinationAbsolutePath,
        outputPath,
      });
    }
  }

  const sortedFiles = files.sort((a, b) =>
    a.outputPath.localeCompare(b.outputPath)
  );

  return Result.ok({
    packageNames: packageNames.sort((a, b) => a.localeCompare(b)),
    files: sortedFiles,
  });
}
