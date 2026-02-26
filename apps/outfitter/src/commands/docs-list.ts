/**
 * `outfitter docs list` - List documentation entries from the docs map.
 *
 * Generates the docs map from the workspace and returns entries,
 * optionally filtered by doc kind or package name.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { loadDocsModule } from "./docs-module-loader.js";
import type { DocsMapEntryShape } from "./docs-types.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.list action handler. */
export interface DocsListInput {
  readonly cwd: string;
  readonly jq?: string | undefined;
  readonly kind?: string | undefined;
  readonly outputMode: CliOutputMode;
  readonly package?: string | undefined;
}

/** Single entry in the docs list output. */
export interface DocsListEntry {
  readonly id: string;
  readonly kind: string;
  readonly outputPath: string;
  readonly package?: string;
  readonly sourcePath: string;
  readonly title: string;
}

/** Output shape for the docs.list action. */
export interface DocsListOutput {
  readonly entries: DocsListEntry[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * List documentation entries from the docs map.
 *
 * Generates the docs map for the workspace and returns a filtered list of
 * entries. Supports filtering by doc kind and package name.
 *
 * @param input - Validated action input
 * @returns Result containing the list of docs entries or an error
 */
export async function runDocsList(
  input: DocsListInput
): Promise<Result<DocsListOutput, InternalError>> {
  try {
    const cwd = resolve(input.cwd);
    const docsModule = await loadDocsModule();
    const mapResult = await docsModule.generateDocsMap({ workspaceRoot: cwd });

    if (mapResult.isErr()) {
      return Result.err(
        new InternalError({
          message: mapResult.error.message,
          context: { action: "docs.list" },
        })
      );
    }

    // better-result's Result2 dist alias prevents tsc from narrowing .value;
    // cast through the known DocsMap shape
    const rawMap = mapResult.value as {
      entries: DocsMapEntryShape[];
    };

    let entries: DocsListEntry[] = rawMap.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      sourcePath: entry.sourcePath,
      outputPath: entry.outputPath,
      ...(entry.package !== undefined ? { package: entry.package } : {}),
    }));

    // Apply kind filter
    if (input.kind) {
      entries = entries.filter((entry) => entry.kind === input.kind);
    }

    // Apply package filter
    if (input.package) {
      entries = entries.filter((entry) => entry.package === input.package);
    }

    return Result.ok({
      entries,
      total: entries.length,
    });
  } catch (error) {
    return Result.err(
      new InternalError({
        message: error instanceof Error ? error.message : "Failed to list docs",
        context: { action: "docs.list" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs list results in the appropriate output format.
 *
 * @param result - The docs list output
 * @param options - Output formatting options
 */
export async function printDocsListResults(
  result: DocsListOutput,
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

  const theme = createTheme();
  const lines: string[] = [];

  if (result.total === 0) {
    lines.push(theme.muted("No documentation entries found."));
    await output(lines, { mode: "human" });
    return;
  }

  lines.push("");
  lines.push(`Documentation Entries (${result.total})`);
  lines.push("=".repeat(60));
  lines.push("");

  for (const entry of result.entries) {
    const pkg = entry.package ? theme.muted(` [${entry.package}]`) : "";
    const kind = theme.muted(`(${entry.kind})`);
    lines.push(`  ${entry.id} ${kind}${pkg}`);
    lines.push(`    ${entry.title}`);
    lines.push(`    ${theme.muted(entry.sourcePath)}`);
    lines.push("");
  }

  await output(lines, { mode: "human" });
}
