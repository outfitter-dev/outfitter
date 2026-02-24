/**
 * @outfitter/docs-core
 *
 * Core docs assembly and freshness-check primitives.
 *
 * Module boundaries:
 * - `types.ts`: public and internal data contracts
 * - `errors.ts`: error taxonomy for docs-core
 * - `options.ts`: options resolution and validation
 * - `expected-output.ts`: collect + transform package docs output
 * - `llms-render.ts`: llms/llms-full rendering
 * - `drift.ts`: drift detection and output cleanup helpers
 *
 * @packageDocumentation
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { Result } from "better-result";

import {
  computeDrift,
  computeExplicitFileDrift,
  pruneEmptyDirectories,
  removeUnexpectedFiles,
} from "./drift.js";
import {
  DocsCoreError as DocsCoreErrorClass,
  type PackageDocsError as PackageDocsErrorType,
} from "./errors.js";
import { buildExpectedOutput } from "./expected-output.js";
import { buildLlmsExpectedFiles } from "./llms-render.js";
import { resolveLlmsOptions, resolveOptions } from "./options.js";
import { relativeToWorkspace } from "./path-utils.js";
import type {
  CheckLlmsDocsResult as CheckLlmsDocsResultType,
  CheckPackageDocsResult as CheckPackageDocsResultType,
  LlmsDocsOptions as LlmsDocsOptionsType,
  PackageDocsOptions as PackageDocsOptionsType,
  SyncLlmsDocsResult as SyncLlmsDocsResultType,
  SyncPackageDocsResult as SyncPackageDocsResultType,
} from "./types.js";

export type { PackageDocsError } from "./errors.js";
// eslint-disable-next-line oxc/no-barrel-file -- preserve existing core/index export shape.
export { DocsCoreError } from "./errors.js";
export type {
  CheckLlmsDocsResult,
  CheckPackageDocsResult,
  DocsDrift,
  DocsWarning,
  DriftKind,
  LlmsDocsOptions,
  LlmsTarget,
  MdxMode,
  PackageDocsOptions,
  SyncLlmsDocsResult,
  SyncPackageDocsResult,
} from "./types.js";

export async function syncPackageDocs(
  options?: PackageDocsOptionsType
): Promise<Result<SyncPackageDocsResultType, PackageDocsErrorType>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const expectedPaths = new Set(expectedOutput.files.keys());
    const unexpectedFiles = await removeUnexpectedFiles({
      outputRoot: resolvedOptions.outputRoot,
      expectedPaths,
    });

    for (const [outputPath, content] of expectedOutput.files.entries()) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }

    await pruneEmptyDirectories(resolvedOptions.outputRoot);

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      writtenFiles: [...expectedOutput.files.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      removedFiles: unexpectedFiles
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreErrorClass) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreErrorClass.internal("Failed to sync package docs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function checkPackageDocs(
  options?: PackageDocsOptionsType
): Promise<Result<CheckPackageDocsResultType, PackageDocsErrorType>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const drift = await computeDrift(resolvedOptions, expectedOutput.files);

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      expectedFiles: [...expectedOutput.files.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      drift,
      isUpToDate: drift.length === 0,
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreErrorClass) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreErrorClass.internal("Failed to check package docs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function syncLlmsDocs(
  options?: LlmsDocsOptionsType
): Promise<Result<SyncLlmsDocsResultType, PackageDocsErrorType>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;
  const resolvedLlmsOptionsResult = resolveLlmsOptions(
    resolvedOptions.workspaceRoot,
    options
  );
  if (resolvedLlmsOptionsResult.isErr()) {
    return resolvedLlmsOptionsResult;
  }

  const resolvedLlmsOptions = resolvedLlmsOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const expectedFiles = buildLlmsExpectedFiles(
      expectedOutput,
      resolvedOptions.workspaceRoot,
      resolvedLlmsOptions
    );

    for (const [outputPath, content] of expectedFiles.entries()) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      writtenFiles: [...expectedFiles.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreErrorClass) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreErrorClass.internal("Failed to sync LLM docs outputs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function checkLlmsDocs(
  options?: LlmsDocsOptionsType
): Promise<Result<CheckLlmsDocsResultType, PackageDocsErrorType>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;
  const resolvedLlmsOptionsResult = resolveLlmsOptions(
    resolvedOptions.workspaceRoot,
    options
  );
  if (resolvedLlmsOptionsResult.isErr()) {
    return resolvedLlmsOptionsResult;
  }

  const resolvedLlmsOptions = resolvedLlmsOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const expectedFiles = buildLlmsExpectedFiles(
      expectedOutput,
      resolvedOptions.workspaceRoot,
      resolvedLlmsOptions
    );
    const drift = await computeExplicitFileDrift(
      resolvedOptions.workspaceRoot,
      expectedFiles
    );

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      expectedFiles: [...expectedFiles.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      drift,
      isUpToDate: drift.length === 0,
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreErrorClass) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreErrorClass.internal("Failed to check LLM docs outputs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}
