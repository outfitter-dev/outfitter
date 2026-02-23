/**
 * Options resolution and validation for docs-core flows.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Result } from "better-result";
import { DocsCoreError, type PackageDocsError } from "./errors.js";
import { isPathInsideWorkspace, pathsOverlap } from "./path-utils.js";
import type {
  LlmsDocsOptions,
  LlmsTarget,
  MdxMode,
  PackageDocsOptions,
  ResolvedLlmsOptions,
  ResolvedPackageDocsOptions,
} from "./types.js";

const DEFAULT_PACKAGES_DIR = "packages";
const DEFAULT_OUTPUT_DIR = "docs/packages";
const DEFAULT_EXCLUDED_FILES = ["CHANGELOG.md"] as const;
const DEFAULT_LLMS_FILE = "docs/llms.txt";
const DEFAULT_LLMS_FULL_FILE = "docs/llms-full.txt";
const DEFAULT_LLMS_TARGETS = ["llms", "llms-full"] as const;
const DEFAULT_MDX_MODE: MdxMode = "lossy";

function normalizeExcludedNames(
  names: readonly string[] | undefined
): ReadonlySet<string> {
  return new Set(
    (names ?? DEFAULT_EXCLUDED_FILES).map((name) => name.toLowerCase())
  );
}

function isMdxMode(value: string): value is MdxMode {
  return value === "strict" || value === "lossy";
}

export function resolveOptions(
  options: PackageDocsOptions | undefined
): Result<ResolvedPackageDocsOptions, PackageDocsError> {
  const workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  const packagesRoot = resolve(
    workspaceRoot,
    options?.packagesDir ?? DEFAULT_PACKAGES_DIR
  );
  const outputRoot = resolve(
    workspaceRoot,
    options?.outputDir ?? DEFAULT_OUTPUT_DIR
  );
  const excludedLowercaseNames = normalizeExcludedNames(
    options?.excludedFilenames
  );
  const mdxMode = options?.mdxMode ?? DEFAULT_MDX_MODE;

  if (!isMdxMode(mdxMode)) {
    return Result.err(
      DocsCoreError.validation("Invalid MDX mode", {
        mdxMode,
      })
    );
  }

  if (!existsSync(workspaceRoot)) {
    return Result.err(
      DocsCoreError.validation("workspaceRoot does not exist", {
        workspaceRoot,
      })
    );
  }

  if (!existsSync(packagesRoot)) {
    return Result.err(
      DocsCoreError.validation("packages directory does not exist", {
        packagesRoot,
      })
    );
  }

  if (!isPathInsideWorkspace(workspaceRoot, outputRoot)) {
    return Result.err(
      DocsCoreError.validation("outputDir must resolve inside workspace", {
        outputRoot,
      })
    );
  }

  if (pathsOverlap(outputRoot, packagesRoot)) {
    return Result.err(
      DocsCoreError.validation(
        "outputDir must not overlap packages directory",
        {
          outputRoot,
          packagesRoot,
        }
      )
    );
  }

  return Result.ok({
    workspaceRoot,
    packagesRoot,
    outputRoot,
    excludedLowercaseNames,
    mdxMode,
  });
}

function isLlmsTarget(value: string): value is LlmsTarget {
  return value === "llms" || value === "llms-full";
}

export function resolveLlmsOptions(
  workspaceRoot: string,
  options: LlmsDocsOptions | undefined
): Result<ResolvedLlmsOptions, PackageDocsError> {
  const llmsPath = resolve(
    workspaceRoot,
    options?.llmsFile ?? DEFAULT_LLMS_FILE
  );
  const llmsFullPath = resolve(
    workspaceRoot,
    options?.llmsFullFile ?? DEFAULT_LLMS_FULL_FILE
  );
  const rawTargets = options?.targets ?? DEFAULT_LLMS_TARGETS;
  const targets = [...new Set(rawTargets)];

  for (const target of targets) {
    if (!isLlmsTarget(target)) {
      return Result.err(
        DocsCoreError.validation("Invalid LLM export target", {
          target,
        })
      );
    }
  }

  if (!isPathInsideWorkspace(workspaceRoot, llmsPath)) {
    return Result.err(
      DocsCoreError.validation("llmsFile must resolve inside workspace", {
        llmsPath,
      })
    );
  }

  if (!isPathInsideWorkspace(workspaceRoot, llmsFullPath)) {
    return Result.err(
      DocsCoreError.validation("llmsFullFile must resolve inside workspace", {
        llmsFullPath,
      })
    );
  }

  if (llmsPath === llmsFullPath) {
    return Result.err(
      DocsCoreError.validation(
        "llmsFile and llmsFullFile must resolve to distinct paths",
        {
          llmsPath,
          llmsFullPath,
        }
      )
    );
  }

  return Result.ok({
    llmsPath,
    llmsFullPath,
    targets,
  });
}
