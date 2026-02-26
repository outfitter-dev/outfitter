/**
 * `outfitter docs show` - Show a specific documentation entry and its content.
 *
 * Generates the docs map, finds the entry by ID, reads the source file,
 * and returns the entry metadata alongside the raw file content.
 *
 * @packageDocumentation
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, NotFoundError, Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { loadDocsModule } from "./docs-module-loader.js";
import type { DocsMapEntryShape } from "./docs-types.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.show action handler. */
export interface DocsShowInput {
  readonly cwd: string;
  readonly id: string;
  readonly jq?: string | undefined;
  readonly outputMode: CliOutputMode;
}

/** Output shape for the docs.show action. */
export interface DocsShowOutput {
  readonly content: string;
  readonly entry: {
    readonly id: string;
    readonly kind: string;
    readonly outputPath: string;
    readonly package?: string;
    readonly sourcePath: string;
    readonly tags: string[];
    readonly title: string;
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Show a specific documentation entry and its file content.
 *
 * Generates the docs map for the workspace, looks up the entry by ID,
 * and reads the source file content.
 *
 * @param input - Validated action input
 * @returns Result containing the entry metadata and content, or an error
 */
export async function runDocsShow(
  input: DocsShowInput
): Promise<Result<DocsShowOutput, InternalError | NotFoundError>> {
  try {
    const cwd = resolve(input.cwd);
    const docsModule = await loadDocsModule();
    const mapResult = await docsModule.generateDocsMap({ workspaceRoot: cwd });

    if (mapResult.isErr()) {
      return Result.err(
        new InternalError({
          message: mapResult.error.message,
          context: { action: "docs.show" },
        })
      );
    }

    // better-result's Result2 dist alias prevents tsc from narrowing .value;
    // cast through the known DocsMap shape
    const rawMap = mapResult.value as {
      entries: DocsMapEntryShape[];
    };

    const entry: DocsMapEntryShape | undefined = rawMap.entries.find(
      (e) => e.id === input.id
    );

    if (!entry) {
      return Result.err(
        NotFoundError.create("doc", input.id, {
          action: "docs.show",
          availableIds: rawMap.entries.map((e) => e.id).slice(0, 10),
        })
      );
    }

    const sourcePath = resolve(cwd, entry.sourcePath);
    const content = await readFile(sourcePath, "utf8");

    return Result.ok({
      entry: {
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        sourcePath: entry.sourcePath,
        outputPath: entry.outputPath,
        ...(entry.package !== undefined ? { package: entry.package } : {}),
        tags: entry.tags,
      },
      content,
    });
  } catch (error) {
    return Result.err(
      new InternalError({
        message: error instanceof Error ? error.message : "Failed to show doc",
        context: { action: "docs.show" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs show results in the appropriate output format.
 *
 * @param result - The docs show output
 * @param options - Output formatting options
 */
export async function printDocsShowResults(
  result: DocsShowOutput,
  options?: { mode?: CliOutputMode; jq?: string | undefined }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    if (options?.jq) {
      const filtered = await applyJq(result, options.jq, {
        compact: structuredMode === "jsonl",
      });
      process.stdout.write(filtered);
    } else {
      await output(result, { mode: structuredMode });
    }
    return;
  }

  const lines: string[] = [];

  lines.push("");
  lines.push(result.entry.title);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`  ID:     ${result.entry.id}`);
  lines.push(`  Kind:   ${result.entry.kind}`);
  lines.push(`  Source: ${result.entry.sourcePath}`);
  lines.push(`  Output: ${result.entry.outputPath}`);
  if (result.entry.package) {
    lines.push(`  Package: ${result.entry.package}`);
  }
  if (result.entry.tags.length > 0) {
    lines.push(`  Tags:   ${result.entry.tags.join(", ")}`);
  }
  lines.push("");
  lines.push("-".repeat(60));
  lines.push("");
  lines.push(result.content);

  await output(lines, { mode: "human" });
}
