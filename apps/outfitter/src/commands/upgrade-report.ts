import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { OutputMode } from "@outfitter/cli/types";
import type { OutfitterError } from "@outfitter/contracts";

import type { VersionConflict } from "./upgrade-workspace.js";
import type {
  CodemodSummary,
  PackageVersionInfo,
  UpgradeOptions,
  UpgradeResult,
} from "./upgrade.js";

export type UpgradeReportStatus =
  | "dry_run"
  | "no_updates"
  | "cancelled"
  | "skipped_non_interactive"
  | "applied"
  | "failed";

/** Snapshot of effective flags for this upgrade run. */
export interface UpgradeReportFlags {
  readonly all: boolean;
  readonly dryRun: boolean;
  readonly interactive: boolean;
  readonly noCodemods: boolean;
  readonly outputMode: OutputMode | null;
  readonly yes: boolean;
}

/** Machine-readable upgrade report written to `.outfitter/reports/upgrade.json`. */
export interface UpgradeReport {
  readonly $schema: "https://outfitter.dev/reports/upgrade/v1";
  readonly applied: boolean;
  readonly checkedAt: string;
  readonly codemods?: CodemodSummary;
  readonly conflicts?: readonly VersionConflict[];
  readonly cwd: string;
  readonly error?: {
    readonly message: string;
    readonly category: string;
    readonly context?: Record<string, unknown>;
  };
  readonly excluded: {
    readonly breaking: readonly string[];
  };
  readonly finishedAt: string;
  readonly flags: UpgradeReportFlags;
  readonly packages: readonly PackageVersionInfo[];
  readonly startedAt: string;
  readonly status: UpgradeReportStatus;
  readonly summary: {
    readonly total: number;
    readonly available: number;
    readonly breaking: number;
    readonly applied: number;
  };
  readonly unknownPackages?: readonly string[];
  readonly workspaceRoot: string | null;
}

export interface WriteUpgradeReportMeta {
  readonly error?: OutfitterError;
  readonly options: UpgradeOptions;
  readonly startedAt: Date;
  readonly status: UpgradeReportStatus;
  readonly workspaceRoot: string | null;
}

/**
 * Write a machine-readable upgrade report to `.outfitter/reports/upgrade.json`.
 *
 * Creates the directory if it doesn't exist. Always represents the latest check state.
 */
function writeUpgradeReport(
  cwd: string,
  result: UpgradeResult,
  meta: WriteUpgradeReportMeta
): void {
  const reportsDir = join(cwd, ".outfitter", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const finishedAtIso = new Date().toISOString();
  const errorContext =
    meta.error !== undefined &&
    "context" in meta.error &&
    meta.error.context !== undefined &&
    typeof meta.error.context === "object"
      ? (meta.error.context as Record<string, unknown>)
      : undefined;

  const report: UpgradeReport = {
    $schema: "https://outfitter.dev/reports/upgrade/v1",
    status: meta.status,
    checkedAt: finishedAtIso,
    startedAt: meta.startedAt.toISOString(),
    finishedAt: finishedAtIso,
    cwd,
    workspaceRoot: meta.workspaceRoot,
    flags: {
      dryRun: meta.options.dryRun === true,
      yes: meta.options.yes === true,
      interactive: meta.options.interactive !== false,
      all: meta.options.all === true,
      noCodemods: meta.options.noCodemods === true,
      outputMode: meta.options.outputMode ?? null,
    },
    applied: result.applied,
    summary: {
      total: result.total,
      available: result.updatesAvailable,
      breaking: result.packages.filter((p) => p.breaking).length,
      applied: result.appliedPackages.length,
    },
    packages: result.packages,
    excluded: {
      breaking: result.skippedBreaking,
    },
    ...(result.unknownPackages !== undefined &&
    result.unknownPackages.length > 0
      ? { unknownPackages: result.unknownPackages }
      : {}),
    ...(result.conflicts !== undefined && result.conflicts.length > 0
      ? { conflicts: result.conflicts }
      : {}),
    ...(result.codemods !== undefined ? { codemods: result.codemods } : {}),
    ...(meta.error !== undefined
      ? {
          error: {
            message: meta.error.message,
            category: meta.error.category,
            ...(errorContext !== undefined ? { context: errorContext } : {}),
          },
        }
      : {}),
  };

  writeFileSync(
    join(reportsDir, "upgrade.json"),
    JSON.stringify(report, null, 2)
  );
}

/**
 * Best-effort report writer.
 *
 * Report I/O failures should not change the primary command result.
 */
export function writeUpgradeReportSafely(
  cwd: string,
  result: UpgradeResult,
  meta: WriteUpgradeReportMeta
): void {
  try {
    writeUpgradeReport(cwd, result, meta);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[outfitter upgrade] Failed to write report: ${reason}\n`
    );
  }
}
