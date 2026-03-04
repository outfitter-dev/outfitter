/**
 * Human-readable output formatting for TSDoc coverage reports.
 *
 * @packageDocumentation
 */

import type { CheckTsDocOptions, TsDocCheckResult } from "./tsdoc-types.js";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve whether JSON output mode is active. */
export function resolveJsonMode(options: CheckTsDocOptions = {}): boolean {
  // eslint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-based feature detection
  return options.json ?? process.env["OUTFITTER_JSON"] === "1";
}

/** Build a visual bar chart for a percentage value. */
function bar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const color =
    percentage >= 80
      ? COLORS.green
      : percentage >= 50
        ? COLORS.yellow
        : COLORS.red;
  return `${color}${"█".repeat(filled)}${COLORS.dim}${"░".repeat(empty)}${COLORS.reset}`;
}

// ---------------------------------------------------------------------------
// Human output
// ---------------------------------------------------------------------------

/**
 * Print a TSDoc coverage result in human-readable format.
 *
 * Renders a bar chart per package with summary statistics. Writes to stdout/stderr.
 *
 * @param result - The coverage result to print
 * @param options - Display options (strict mode, coverage threshold for warning)
 */
export function printCheckTsdocHuman(
  result: TsDocCheckResult,
  options?: { strict?: boolean | undefined; minCoverage?: number | undefined }
): void {
  process.stdout.write(
    `\n${COLORS.bold}TSDoc Coverage Report${COLORS.reset}\n\n`
  );

  for (const pkg of result.packages) {
    const color =
      pkg.percentage >= 80
        ? COLORS.green
        : pkg.percentage >= 50
          ? COLORS.yellow
          : COLORS.red;

    process.stdout.write(
      `  ${color}${pkg.percentage.toString().padStart(3)}%${COLORS.reset} ${bar(pkg.percentage)} ${pkg.name}\n`
    );

    if (pkg.total > 0) {
      const parts: string[] = [];
      if (pkg.documented > 0)
        parts.push(
          `${COLORS.green}${pkg.documented} documented${COLORS.reset}`
        );
      if (pkg.partial > 0)
        parts.push(`${COLORS.yellow}${pkg.partial} partial${COLORS.reset}`);
      if (pkg.undocumented > 0)
        parts.push(
          `${COLORS.red}${pkg.undocumented} undocumented${COLORS.reset}`
        );
      process.stdout.write(
        `       ${COLORS.dim}${pkg.total} declarations:${COLORS.reset} ${parts.join(", ")}\n`
      );
    } else {
      process.stdout.write(
        `       ${COLORS.dim}no exported declarations${COLORS.reset}\n`
      );
    }
  }

  const { summary } = result;
  process.stdout.write(
    `\n  ${COLORS.bold}Summary:${COLORS.reset} ${summary.percentage}% coverage (${summary.documented} documented, ${summary.partial} partial, ${summary.undocumented} undocumented of ${summary.total} total)\n`
  );

  const minCoverage = options?.minCoverage ?? 0;
  if (options?.strict && summary.percentage < minCoverage) {
    process.stderr.write(
      `\n  ${COLORS.red}Coverage ${summary.percentage}% is below minimum threshold of ${minCoverage}%${COLORS.reset}\n`
    );
  }

  process.stdout.write("\n");
}
