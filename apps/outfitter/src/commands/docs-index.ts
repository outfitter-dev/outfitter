/**
 * `outfitter docs index` - Assemble docs and build qmd search index.
 *
 * Detects workspace vs consumer context, assembles markdown files into
 * a central assembly directory, then indexes them via QMD for hybrid search.
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.index action handler. */
export interface DocsIndexInput {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

/** Output shape for the docs.index action. */
export interface DocsIndexOutput {
  readonly assemblyPath: string;
  readonly embedded: number;
  readonly indexed: number;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Detect whether the working directory is a monorepo workspace.
 *
 * @param cwd - Working directory to inspect
 * @returns `true` if `package.json` contains a `workspaces` field
 */
function isWorkspaceRoot(cwd: string): boolean {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }

  try {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { workspaces?: unknown };
    return Array.isArray(pkg.workspaces);
  } catch {
    return false;
  }
}

/**
 * Collect markdown files from workspace paths using Bun.Glob and copy them
 * into the assembly directory, preserving relative structure.
 *
 * @param cwd - Workspace root directory
 * @param assemblyPath - Target assembly directory
 * @returns Number of files copied
 */
async function assembleWorkspaceDocs(
  cwd: string,
  assemblyPath: string
): Promise<number> {
  const patterns = [
    "docs/**/*.md",
    "packages/*/README.md",
    "packages/*/docs/**/*.md",
  ];

  let copied = 0;

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const match of glob.scan({ cwd, absolute: false })) {
      const sourcePath = join(cwd, match);
      const targetPath = join(assemblyPath, match);

      // Ensure target directory exists
      mkdirSync(dirname(targetPath), { recursive: true });

      const content = await Bun.file(sourcePath).text();
      await Bun.write(targetPath, content);
      copied++;
    }
  }

  return copied;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Assemble docs and build qmd search index.
 *
 * In workspace mode, collects markdown from the docs directory, package
 * READMEs, and package docs into the assembly directory, then indexes
 * via QMD for hybrid search.
 *
 * @param input - Validated action input
 * @returns Result containing index stats or an error
 */
export async function runDocsIndex(
  input: DocsIndexInput
): Promise<Result<DocsIndexOutput, InternalError>> {
  try {
    const cwd = resolve(input.cwd);
    const assemblyPath = join(homedir(), ".outfitter", "docs", "assembled");

    // Assemble docs if in workspace context
    if (isWorkspaceRoot(cwd)) {
      await assembleWorkspaceDocs(cwd, assemblyPath);
    }

    // Dynamically import to avoid hard dep at module level
    const { createDocsSearch } = (await import("@outfitter/docs/search")) as {
      createDocsSearch: typeof import("@outfitter/docs/search").createDocsSearch;
    };

    const docs = await createDocsSearch({
      name: "outfitter",
      paths: [assemblyPath],
      assemblyPath,
    });

    try {
      const indexResult = await docs.index();

      if (indexResult.isErr()) {
        return Result.err(
          new InternalError({
            message:
              indexResult.error instanceof Error
                ? indexResult.error.message
                : "Failed to build search index",
            context: { action: "docs.index" },
          })
        );
      }

      return Result.ok({
        indexed: indexResult.value.indexed,
        embedded: indexResult.value.embedded,
        assemblyPath,
      });
    } finally {
      await docs.close();
    }
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to build search index",
        context: { action: "docs.index" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs index results in the appropriate output format.
 *
 * @param result - The docs index output
 * @param options - Output formatting options
 */
export async function printDocsIndexResults(
  result: DocsIndexOutput,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    await output(result, structuredMode);
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];

  lines.push("");
  lines.push("Search Index Built");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`  Indexed:  ${result.indexed} document(s)`);
  lines.push(`  Embedded: ${result.embedded} chunk(s)`);
  lines.push(`  Path:     ${theme.muted(result.assemblyPath)}`);
  lines.push("");

  await output(lines, "human");
}
