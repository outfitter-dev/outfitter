/**
 * Commander-to-builder codemod handler.
 *
 * Detects `.command().action()` patterns in source files and transforms them
 * to the builder pattern with `.input(schema).action()`. Generates Zod schema
 * skeletons from existing `.option()` / `.argument()` declarations.
 *
 * Complex commands (nested subcommands, dynamic patterns) are left as-is
 * and reported as skipped with `cli.register()` fallback.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { runCodemod } from "./upgrade-codemods.js";

// =============================================================================
// Types
// =============================================================================

/** Options for the Commander-to-builder codemod. */
export interface UpgradeCodemodBuilderOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd: string;
  /** Preview changes without writing to disk */
  readonly dryRun: boolean;
}

/** Result of the Commander-to-builder codemod. */
export interface UpgradeCodemodBuilderResult {
  /** Files that were successfully transformed */
  readonly changedFiles: readonly string[];
  /** Whether this was a dry run */
  readonly dryRun: boolean;
  /** Errors encountered during transformation */
  readonly errors: readonly string[];
  /** Whether all operations succeeded (no errors) */
  readonly ok: boolean;
  /** Files skipped (too complex or already migrated) */
  readonly skippedFiles: readonly string[];
  /** Total files scanned */
  readonly totalChanged: number;
  /** Total files skipped */
  readonly totalSkipped: number;
}

// =============================================================================
// Codemod Path Resolution
// =============================================================================

/**
 * Resolve the path to the Commander-to-builder codemod.
 *
 * In development mode (running from source), the codemod lives in the
 * plugins directory relative to the CLI source.
 */
function resolveCodemodPath(): string {
  return resolve(
    import.meta.dir,
    "../../../../plugins/outfitter/shared/codemods/cli/commander-to-builder.ts"
  );
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Run the Commander-to-builder codemod on a target directory.
 *
 * Scans TypeScript files for Commander-style `.command().action()` patterns
 * and transforms them to the builder pattern with generated Zod schema
 * skeletons.
 *
 * @param options - Codemod options including cwd and dryRun
 * @returns Result with transformation report
 */
export async function runUpgradeCodemodBuilder(
  options: UpgradeCodemodBuilderOptions
): Promise<Result<UpgradeCodemodBuilderResult, OutfitterError>> {
  const cwd = resolve(options.cwd);
  const codemodPath = resolveCodemodPath();

  const result = await runCodemod(codemodPath, cwd, options.dryRun);

  if (result.isErr()) {
    return Result.err(
      InternalError.create("Commander-to-builder codemod failed", {
        cwd,
        error: result.error.message,
      })
    );
  }

  const { changedFiles, skippedFiles, errors } = result.value;

  return Result.ok({
    changedFiles,
    skippedFiles,
    errors,
    dryRun: options.dryRun,
    ok: errors.length === 0,
    totalChanged: changedFiles.length,
    totalSkipped: skippedFiles.length,
  });
}

/**
 * Render codemod results to stdout.
 */
export async function printUpgradeCodemodBuilderResult(
  result: UpgradeCodemodBuilderResult,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    await output(result, structuredMode);
    return;
  }

  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("[codemod] dry run — no files modified\n");
  }

  if (result.totalChanged > 0) {
    lines.push(
      `[codemod] transformed ${result.totalChanged} file(s) from Commander to builder pattern:\n`
    );
    for (const file of result.changedFiles) {
      lines.push(`  ✓ ${file}\n`);
    }
  } else {
    lines.push("[codemod] no files needed transformation\n");
  }

  if (result.totalSkipped > 0) {
    lines.push(
      `\n[codemod] skipped ${result.totalSkipped} file(s) (too complex or already migrated):\n`
    );
    for (const file of result.skippedFiles) {
      lines.push(`  ⊘ ${file} — use cli.register() fallback\n`);
    }
  }

  if (result.errors.length > 0) {
    lines.push(`\n[codemod] ${result.errors.length} error(s):\n`);
    for (const error of result.errors) {
      lines.push(`  ✗ ${error}\n`);
    }
  }

  for (const line of lines) {
    process.stdout.write(line);
  }
}
