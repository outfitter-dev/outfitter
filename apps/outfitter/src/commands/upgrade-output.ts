import { output } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";
import { createTheme } from "@outfitter/tui/render";

import { resolveStructuredOutputMode } from "../output-mode.js";
import {
  findMigrationDocsDir,
  readMigrationDocs,
} from "./upgrade-migration-docs.js";
import type { UpgradeResult } from "./upgrade.js";

/** Options controlling how upgrade results are rendered. */
export interface PrintUpgradeResultsOptions {
  readonly all?: boolean;
  readonly cwd?: string;
  readonly dryRun?: boolean;
  readonly guide?: boolean;
  readonly mode?: OutputMode;
}

/**
 * Format and output upgrade results.
 *
 * @param result - Upgrade scan/apply result to render
 * @param options - Display options (output mode, guide, dry-run hints)
 */
export async function printUpgradeResults(
  result: UpgradeResult,
  options?: PrintUpgradeResultsOptions
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    await output(result, { mode: structuredMode });
    return;
  }

  const theme = createTheme();
  const lines: string[] = ["", "Outfitter Upgrade", "", "=".repeat(60)];

  if (result.packages.length === 0) {
    lines.push("No @outfitter/* packages found in package.json.");
    if (!result.unknownPackages || result.unknownPackages.length === 0) {
      await output(lines, { mode: "human" });
      return;
    }
    lines.push("");
  } else {
    // Version table header
    lines.push(
      `  ${"Package".padEnd(28)} ${"Current".padEnd(10)} ${"Available".padEnd(10)} Migration`
    );
    lines.push(
      `  ${"─".repeat(28)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(20)}`
    );

    for (const pkg of result.packages) {
      const name = pkg.name.padEnd(28);
      const current = pkg.current.padEnd(10);
      const available = (pkg.latest ?? "unknown").padEnd(10);

      let migration: string;
      if (pkg.latest === null) {
        migration = theme.muted("lookup failed");
      } else if (!pkg.updateAvailable) {
        migration = theme.muted("up to date");
      } else if (pkg.breaking) {
        migration = theme.error("breaking");
      } else {
        migration = theme.success("non-breaking");
      }

      lines.push(`  ${name} ${current} ${available} ${migration}`);
    }

    lines.push("");
  }

  // Apply summary
  if (result.applied && result.appliedPackages.length > 0) {
    // Separate applied packages into breaking and non-breaking for display
    const breakingApplied = result.appliedPackages.filter((name) =>
      result.packages.some((p) => p.name === name && p.breaking)
    );
    const nonBreakingApplied = result.appliedPackages.filter(
      (name) => !result.packages.some((p) => p.name === name && p.breaking)
    );

    if (nonBreakingApplied.length > 0) {
      lines.push(
        theme.success(
          `Applied ${nonBreakingApplied.length} non-breaking upgrade(s):`
        )
      );
      for (const name of nonBreakingApplied) {
        lines.push(`  - ${name}`);
      }
      lines.push("");
    }

    if (breakingApplied.length > 0) {
      lines.push(
        theme.error(`Applied ${breakingApplied.length} breaking upgrade(s):`)
      );
      for (const name of breakingApplied) {
        const pkg = result.packages.find((p) => p.name === name);
        lines.push(`  - ${name} (${pkg?.current} -> ${pkg?.latest})`);
      }
      lines.push(
        "",
        theme.muted("Review migration guides: 'outfitter upgrade --guide'")
      );
      lines.push("");
    }
  }

  // Excluded breaking section (when --all is NOT used and breaking changes exist)
  if (result.skippedBreaking.length > 0 && options?.all !== true) {
    if (result.applied) {
      lines.push(
        theme.error(
          `Skipped ${result.skippedBreaking.length} breaking upgrade(s):`
        )
      );
    } else {
      lines.push("  Excluded (breaking):");
    }
    for (const name of result.skippedBreaking) {
      const pkg = result.packages.find((p) => p.name === name);
      const codemodHint = pkg?.breaking ? "(migration guide)" : "";
      lines.push(
        `    ${name.padEnd(24)} ${(pkg?.current ?? "").padEnd(8)} -> ${(pkg?.latest ?? "").padEnd(8)} ${codemodHint}`.trimEnd()
      );
    }
    lines.push("", theme.muted("  Use --all to include breaking changes"));
    lines.push("");
  }

  if (result.codemods !== undefined) {
    const uniqueChangedFiles = [
      ...new Set(result.codemods.changedFiles),
    ].toSorted();
    lines.push(theme.info(`Ran ${result.codemods.codemodCount} codemod(s).`));

    if (uniqueChangedFiles.length > 0) {
      lines.push(
        theme.success(`Codemods changed ${uniqueChangedFiles.length} file(s):`)
      );
      for (const file of uniqueChangedFiles) {
        lines.push(`  - ${file}`);
      }
    }

    if (result.codemods.errors.length > 0) {
      lines.push(
        theme.error(`Codemod errors (${result.codemods.errors.length}):`)
      );
      for (const error of result.codemods.errors) {
        lines.push(`  - ${error}`);
      }
    }

    lines.push("");
  }

  // Version conflicts section
  if (result.conflicts && result.conflicts.length > 0) {
    lines.push(
      theme.warning(
        `Version conflict(s) across workspace (${result.conflicts.length}):`
      )
    );
    for (const conflict of result.conflicts) {
      lines.push(`  ${conflict.name}`);
      for (const entry of conflict.versions) {
        const manifests = entry.manifests
          .map((m) => {
            // Show the parent directory of package.json (e.g. "packages/cli")
            const dir = m.replace(/\/package\.json$/, "");
            const parts = dir.split("/");
            // Take last 2 path segments for readability
            return parts.slice(-2).join("/");
          })
          .join(", ");
        lines.push(`    ${entry.version.padEnd(10)} ${theme.muted(manifests)}`);
      }
    }
    lines.push("");
  }

  // Unknown packages section
  if (result.unknownPackages && result.unknownPackages.length > 0) {
    lines.push(theme.error("Unknown package(s) not found in workspace:"));
    for (const name of result.unknownPackages) {
      lines.push(`  - ${name}`);
    }
    lines.push("");
  }

  if (!result.applied) {
    if (options?.dryRun) {
      lines.push(theme.muted("Dry run — no changes applied."));
    } else if (result.updatesAvailable > 0) {
      lines.push(
        theme.muted(
          "Run 'outfitter upgrade --guide' for migration instructions."
        )
      );
    } else {
      lines.push(theme.success("All packages are up to date."));
    }
  }

  // Structured migration guide section (from result.guides)
  if (options?.guide && result.guides && result.guides.length > 0) {
    lines.push("", "=".repeat(60), "", "Migration Guide", "");

    for (const guide of result.guides) {
      const label = guide.breaking
        ? theme.error("BREAKING")
        : theme.success("non-breaking");
      lines.push(
        `${theme.info(guide.packageName)} ${guide.fromVersion} -> ${guide.toVersion} [${label}]`
      );

      if (guide.steps.length > 0) {
        for (const step of guide.steps) {
          lines.push(`  ${step}`);
        }
      } else {
        lines.push(
          `  ${theme.muted("No migration steps available. Check release notes.")}`
        );
      }
      lines.push("");
    }
  } else if (options?.guide && result.updatesAvailable > 0 && !result.guides) {
    // Fallback: --guide was requested in output but guides weren't built into the result
    const cwd = options.cwd ?? process.cwd();
    const migrationsDir = findMigrationDocsDir(cwd);

    if (migrationsDir) {
      lines.push("", "=".repeat(60), "", "Migration Guide", "");

      for (const pkg of result.packages) {
        if (!(pkg.updateAvailable && pkg.latest)) continue;

        const shortName = pkg.name.replace("@outfitter/", "");
        const docs = readMigrationDocs(
          migrationsDir,
          shortName,
          pkg.current,
          pkg.latest
        );

        for (const doc of docs) {
          lines.push(doc, "", "---", "");
        }
      }
    } else {
      lines.push(
        "",
        theme.muted(
          "Migration docs not found locally. See https://github.com/outfitter-dev/outfitter for migration guides."
        )
      );
    }
  }

  await output(lines, { mode: "human" });
}
