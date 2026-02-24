/**
 * `outfitter docs export` - Export documentation to various targets.
 *
 * Wraps the existing `executeExportCommand` from "@outfitter/docs" as a
 * formal action, supporting package docs, llms.txt, and llms-full.txt
 * export targets.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

export type { DocsExportTarget } from "./docs-module-loader.js";

import type { DocsExportTarget } from "./docs-module-loader.js";
import { loadDocsModule } from "./docs-module-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.export action handler. */
export interface DocsExportInput {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
  readonly target: DocsExportTarget;
}

/** Output shape for the docs.export action. */
export interface DocsExportOutput {
  readonly exitCode: number;
  readonly messages: string[];
  readonly target: string;
  readonly warnings: string[];
}

interface DocsExportDependencies {
  readonly loadDocsModule?: typeof loadDocsModule;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Export documentation to the specified target format.
 *
 * Delegates to `executeExportCommand` from "@outfitter/docs" via the
 * dynamic module loader.
 *
 * @param input - Validated action input
 * @returns Result containing the export output or an error
 */
export async function runDocsExport(
  input: DocsExportInput,
  dependencies?: DocsExportDependencies
): Promise<Result<DocsExportOutput, InternalError>> {
  try {
    const loadDocs = dependencies?.loadDocsModule ?? loadDocsModule;
    const cwd = resolve(input.cwd);
    const docsModule = await loadDocs();

    const messages: string[] = [];
    const warnings: string[] = [];

    const exitCode = await docsModule.executeExportCommand(
      {
        cwd,
        target: input.target,
      },
      {
        out: (line: string) => messages.push(line),
        err: (line: string) => warnings.push(line),
      }
    );

    if (exitCode !== 0) {
      return Result.err(
        new InternalError({
          message: warnings.join("\n") || "Export failed",
          context: { action: "docs.export", target: input.target },
        })
      );
    }

    return Result.ok({
      target: input.target,
      messages,
      warnings,
      exitCode,
    });
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Failed to export docs",
        context: { action: "docs.export" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs export results in the appropriate output format.
 *
 * @param result - The docs export output
 * @param options - Output formatting options
 */
export async function printDocsExportResults(
  result: DocsExportOutput,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    await output(result, { mode: structuredMode });
    return;
  }

  const lines: string[] = [];

  if (result.messages.length > 0) {
    for (const msg of result.messages) {
      lines.push(msg);
    }
  } else {
    lines.push("Export completed.");
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`  ${warning}`);
    }
  }

  await output(lines, { mode: "human" });
}
