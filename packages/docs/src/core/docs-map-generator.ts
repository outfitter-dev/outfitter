/* eslint-disable outfitter/max-file-lines -- Docs map generate/read/write logic is a cohesive manifest module. */
/**
 * Docs map generator.
 *
 * Discovers publishable packages in a monorepo workspace, collects their
 * markdown documentation files, and produces a {@link DocsMap} manifest
 * suitable for writing to ".outfitter/docs-map.json".
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { Result } from "better-result";

import {
  type DocsMap,
  type DocsMapEntry,
  DocsMapSchema,
} from "./docs-map-schema.js";
import { DocsCoreError, type PackageDocsOptions } from "./index.js";
import {
  DEFAULT_EXCLUDED_FILES,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_PACKAGES_DIR,
  DOCS_MAP_DIR,
  DOCS_MAP_FILENAME,
  extractFirstHeading,
  inferDocKind,
  isPathInsideWorkspace,
  pathsOverlap,
  readPackageVersion,
  toPosixPath,
} from "./internal/docs-map-helpers.js";
import { collectPackageDocs } from "./package-doc-collection.js";

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

/**
 * Options for the docs map generator.
 *
 * Extends {@link PackageDocsOptions} with an optional override for the
 * output directory of "docs-map.json".
 */
export interface GenerateDocsMapOptions extends PackageDocsOptions {
  /** Override output directory for docs-map.json (defaults to ".outfitter/"). */
  readonly docsMapDir?: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a docs map from a monorepo workspace.
 *
 * Discovers publishable packages under the packages directory, collects
 * their markdown files (root-level and "docs/" subtree), and builds a
 * {@link DocsMap} with inferred kinds and extracted titles.
 *
 * @param options - Workspace and path configuration
 * @returns A Result containing the generated DocsMap or a DocsCoreError
 *
 * @example
 * ```typescript
 * const result = await generateDocsMap({ workspaceRoot: "/path/to/repo" });
 * if (result.isOk()) {
 *   console.log(result.value.entries.length, "docs found");
 * }
 * ```
 */
export async function generateDocsMap(
  options?: GenerateDocsMapOptions
): Promise<Result<DocsMap, DocsCoreError>> {
  const workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  const packagesRoot = resolve(
    workspaceRoot,
    options?.packagesDir ?? DEFAULT_PACKAGES_DIR
  );
  const outputRoot = resolve(
    workspaceRoot,
    options?.outputDir ?? DEFAULT_OUTPUT_DIR
  );
  const excludedNames = options?.excludedFilenames
    ? new Set(options.excludedFilenames.map((n) => n.toLowerCase()))
    : DEFAULT_EXCLUDED_FILES;

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

  try {
    const collectedFilesResult = await collectPackageDocs({
      workspaceRoot,
      packagesRoot,
      outputRoot,
      excludedLowercaseNames: excludedNames,
    });
    if (collectedFilesResult.isErr()) {
      const error = collectedFilesResult.error;
      if (error.kind === "outputPathOutsideWorkspace") {
        return Result.err(
          DocsCoreError.validation("outputPath must resolve inside workspace", {
            sourcePath: error.sourcePath,
            outputAbsPath: error.outputAbsolutePath,
          })
        );
      }

      return Result.err(
        DocsCoreError.validation("docs-map output path collision", {
          outputPath: error.outputPath,
          sourcePath: error.sourcePath,
          collisionSourcePath: error.collisionSourcePath,
        })
      );
    }

    const entries: DocsMapEntry[] = [];

    for (const file of collectedFilesResult.value.files) {
      const id = `${file.packageName}/${toPosixPath(file.relativeFromPackageRoot)}`;
      const kind = inferDocKind(file.sourcePath, file.packageName);

      const content = await readFile(file.sourceAbsolutePath, "utf8");
      const title =
        extractFirstHeading(content) ??
        file.relativeFromPackageRoot
          .split("/")
          .at(-1)
          ?.replace(/\.mdx?$/, "") ??
        id;

      entries.push({
        id,
        kind,
        title,
        sourcePath: file.sourcePath,
        outputPath: file.outputPath,
        package: file.packageName,
        tags: [],
      });
    }

    // Sort entries deterministically by id
    entries.sort((a, b) => a.id.localeCompare(b.id));

    const version = await readPackageVersion(workspaceRoot);
    const generator = `@outfitter/docs@${version ?? "unknown"}`;

    const docsMap: DocsMap = {
      generatedAt: new Date().toISOString(),
      generator,
      entries,
    };

    return Result.ok(docsMap);
  } catch (error) {
    if (error instanceof DocsCoreError) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreError.internal("Failed to generate docs map", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Write a docs map to ".outfitter/docs-map.json".
 *
 * Creates the ".outfitter/" directory if it does not exist. Returns the
 * absolute path of the written file on success.
 *
 * @param docsMap - The DocsMap manifest to write
 * @param options - Workspace root and optional directory overrides
 * @returns A Result containing the absolute path written to, or a DocsCoreError
 *
 * @example
 * ```typescript
 * const writeResult = await writeDocsMap(docsMap, { workspaceRoot: "/repo" });
 * if (writeResult.isOk()) {
 *   console.log("Wrote", writeResult.value);
 * }
 * ```
 */
export async function writeDocsMap(
  docsMap: DocsMap,
  options?: { workspaceRoot?: string; docsMapDir?: string }
): Promise<Result<string, DocsCoreError>> {
  const workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  const docsMapDir = resolve(
    workspaceRoot,
    options?.docsMapDir ?? DOCS_MAP_DIR
  );

  if (!isPathInsideWorkspace(workspaceRoot, docsMapDir)) {
    return Result.err(
      DocsCoreError.validation("docsMapDir must resolve inside workspace", {
        docsMapDir,
      })
    );
  }

  const docsMapPath = join(docsMapDir, DOCS_MAP_FILENAME);

  try {
    await mkdir(docsMapDir, { recursive: true });
    const json = JSON.stringify(docsMap, null, "\t");
    await writeFile(docsMapPath, `${json}\n`, "utf8");
    return Result.ok(docsMapPath);
  } catch (error) {
    return Result.err(
      DocsCoreError.internal("Failed to write docs map", {
        path: docsMapPath,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read and validate a docs map from ".outfitter/docs-map.json".
 *
 * Parses the JSON file and validates it against the {@link DocsMapSchema}.
 * Returns a validation error if the file is missing or has an invalid shape.
 *
 * @param options - Workspace root and optional directory overrides
 * @returns A Result containing the parsed DocsMap or a DocsCoreError
 *
 * @example
 * ```typescript
 * const readResult = await readDocsMap({ workspaceRoot: "/repo" });
 * if (readResult.isOk()) {
 *   console.log(readResult.value.entries.length, "entries");
 * }
 * ```
 */
export async function readDocsMap(options?: {
  workspaceRoot?: string;
  docsMapDir?: string;
}): Promise<Result<DocsMap, DocsCoreError>> {
  const workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  const docsMapDir = resolve(
    workspaceRoot,
    options?.docsMapDir ?? DOCS_MAP_DIR
  );
  const docsMapPath = join(docsMapDir, DOCS_MAP_FILENAME);

  if (!isPathInsideWorkspace(workspaceRoot, docsMapDir)) {
    return Result.err(
      DocsCoreError.validation("docsMapDir must resolve inside workspace", {
        docsMapDir,
      })
    );
  }

  if (!existsSync(docsMapPath)) {
    return Result.err(
      DocsCoreError.validation("docs-map.json not found", {
        path: docsMapPath,
      })
    );
  }

  try {
    const raw = await readFile(docsMapPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const validationResult = DocsMapSchema.safeParse(parsed);

    if (!validationResult.success) {
      return Result.err(
        DocsCoreError.validation("Invalid docs-map.json schema", {
          path: docsMapPath,
          errors: validationResult.error.issues,
        })
      );
    }

    return Result.ok(validationResult.data);
  } catch (error) {
    return Result.err(
      DocsCoreError.internal("Failed to read docs map", {
        path: docsMapPath,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}
