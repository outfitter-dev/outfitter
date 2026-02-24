/**
 * Build expected package docs output set.
 *
 * @packageDocumentation
 */

import { readFile } from "node:fs/promises";
import {
  processDocsSourceContent,
  rewriteMarkdownLinks,
} from "./content-processing.js";
import { DocsCoreError } from "./errors.js";
import { collectPackageDocs } from "./package-doc-collection.js";
import { toPosixPath } from "./path-utils.js";
import type {
  CollectedMarkdownFile,
  DocsWarning,
  ExpectedOutput,
  ExpectedOutputEntry,
  ResolvedPackageDocsOptions,
} from "./types.js";

export async function buildExpectedOutput(
  options: ResolvedPackageDocsOptions
): Promise<ExpectedOutput> {
  const collectedDocsResult = await collectPackageDocs({
    workspaceRoot: options.workspaceRoot,
    packagesRoot: options.packagesRoot,
    outputRoot: options.outputRoot,
    excludedLowercaseNames: options.excludedLowercaseNames,
  });
  if (collectedDocsResult.isErr()) {
    const error = collectedDocsResult.error;
    if (error.kind === "outputPathOutsideWorkspace") {
      throw DocsCoreError.validation(
        "outputPath must resolve inside workspace",
        {
          sourcePath: error.sourcePath,
          outputAbsPath: error.outputAbsolutePath,
        }
      );
    }

    throw DocsCoreError.validation(
      "Multiple source docs files resolve to the same output path",
      {
        outputPath: error.outputPath,
        firstSourcePath: error.collisionSourcePath,
        secondSourcePath: error.sourcePath,
      }
    );
  }

  const collectedFiles: CollectedMarkdownFile[] =
    collectedDocsResult.value.files.map((file) => ({
      packageName: file.packageName,
      sourceAbsolutePath: file.sourceAbsolutePath,
      destinationAbsolutePath: file.destinationAbsolutePath,
    }));
  const files = new Map<string, string>();
  const warnings: DocsWarning[] = [];

  const mirrorTargetBySourcePath = new Map<string, string>(
    collectedFiles.map((file) => [
      file.sourceAbsolutePath,
      file.destinationAbsolutePath,
    ])
  );

  const sortedCollectedFiles = [...collectedFiles].sort((a, b) =>
    toPosixPath(a.destinationAbsolutePath).localeCompare(
      toPosixPath(b.destinationAbsolutePath)
    )
  );
  const entries: ExpectedOutputEntry[] = [];

  for (const collectedFile of sortedCollectedFiles) {
    const sourceContent = await readFile(
      collectedFile.sourceAbsolutePath,
      "utf8"
    );
    const processedContentResult = processDocsSourceContent({
      content: sourceContent,
      sourceAbsolutePath: collectedFile.sourceAbsolutePath,
      workspaceRoot: options.workspaceRoot,
      mdxMode: options.mdxMode,
    });
    if (processedContentResult.isErr()) {
      throw processedContentResult.error;
    }

    const rewrittenContent = rewriteMarkdownLinks(
      processedContentResult.value.content,
      collectedFile.sourceAbsolutePath,
      collectedFile.destinationAbsolutePath,
      options.workspaceRoot,
      mirrorTargetBySourcePath
    );

    warnings.push(...processedContentResult.value.warnings);

    files.set(collectedFile.destinationAbsolutePath, rewrittenContent);
    entries.push({
      packageName: collectedFile.packageName,
      destinationAbsolutePath: collectedFile.destinationAbsolutePath,
      content: rewrittenContent,
    });
  }

  return {
    packageNames: collectedDocsResult.value.packageNames,
    files,
    entries,
    warnings,
  };
}
