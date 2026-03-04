/**
 * TDD-aware pre-push verification command
 *
 * Supports TDD workflow by detecting RED phase branches (test-only changes)
 * and allowing them to push even when strict verification would fail by design.
 *
 * RED phase branches match: *-tests, *\/tests, *_tests
 *
 * @packageDocumentation
 */

// Re-export public API from internal module
export {
  isRedPhaseBranch,
  isScaffoldBranch,
  isReleaseBranch,
  isTestOnlyPath,
  areFilesTestOnly,
  canBypassRedPhaseByChangedFiles,
  hasPackageSourceChanges,
  createVerificationPlan,
  checkBunVersion,
} from "./internal/pre-push-checks.js";

export type {
  PushChangedFiles,
  VerificationPlan,
  BunVersionCheckResult,
} from "./internal/pre-push-checks.js";

import {
  canBypassRedPhaseByChangedFiles,
  checkBunVersion,
  createVerificationPlan,
  getChangedFilesForPush,
  getCurrentBranch,
  hasPackageSourceChanges,
  hasRedPhaseBranchInContext,
  isRedPhaseBranch,
  isReleaseBranch,
  isScaffoldBranch,
  printTsdocSummary,
  readPackageScripts,
} from "./internal/pre-push-checks.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function runScript(scriptName: string): boolean {
  log("");
  log(`Running: ${COLORS.blue}bun run ${scriptName}${COLORS.reset}`);
  const result = Bun.spawnSync(["bun", "run", scriptName], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  return result.exitCode === 0;
}

// ---------------------------------------------------------------------------
// RED-phase bypass with logging
// ---------------------------------------------------------------------------

function maybeSkipForRedPhase(
  reason: "branch" | "context",
  branch: string
): boolean {
  const changedFiles = getChangedFilesForPush();
  if (!changedFiles.deterministic) {
    log(
      `${COLORS.yellow}RED-phase bypass denied${COLORS.reset}: could not determine full push diff range`
    );
    log("Running strict verification.");
    log("");
    return false;
  }

  if (!canBypassRedPhaseByChangedFiles(changedFiles)) {
    log(
      `${COLORS.yellow}RED-phase bypass denied${COLORS.reset}: changed files are not test-only`
    );
    if (changedFiles.files.length > 0) {
      log(
        `Changed files (${changedFiles.source}): ${changedFiles.files.join(", ")}`
      );
    } else {
      log(
        `No changed files detected in ${changedFiles.source} range. Running strict verification.`
      );
    }
    log("");
    return false;
  }

  if (reason === "branch") {
    log(
      `${COLORS.yellow}TDD RED phase${COLORS.reset} detected: ${COLORS.blue}${branch}${COLORS.reset}`
    );
  } else {
    log(
      `${COLORS.yellow}Scaffold branch${COLORS.reset} with RED phase branch in context: ${COLORS.blue}${branch}${COLORS.reset}`
    );
  }
  log(
    `${COLORS.yellow}Skipping strict verification${COLORS.reset} - changed files are test-only`
  );
  log(`Diff source: ${changedFiles.source}`);
  log("");
  log("Remember: GREEN phase (implementation) must make these tests pass!");
  return true;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface PrePushOptions {
  force?: boolean;
}

/** Main pre-push command */
export async function runPrePush(options: PrePushOptions = {}): Promise<void> {
  log(`${COLORS.blue}Pre-push verify${COLORS.reset} (TDD-aware)`);
  log("");

  // Force flag bypasses all strict verification checks.
  if (options.force) {
    log(
      `${COLORS.yellow}Force flag set${COLORS.reset} - skipping strict verification`
    );
    process.exitCode = 0;
    return;
  }

  const versionCheck = checkBunVersion();
  if (!versionCheck.matches) {
    log(
      `${COLORS.red}Bun version mismatch${COLORS.reset}: running ${versionCheck.actual}, pinned ${versionCheck.expected}`
    );
    log("Fix: bunx @outfitter/tooling upgrade-bun");
    log("");
    process.exitCode = 1;
    return;
  }

  const branch = getCurrentBranch();

  if (isReleaseBranch(branch)) {
    log(
      `${COLORS.yellow}Release branch detected${COLORS.reset}: ${COLORS.blue}${branch}${COLORS.reset}`
    );
    log(
      `${COLORS.yellow}Skipping strict verification${COLORS.reset} for automated changeset release push`
    );
    process.exitCode = 0;
    return;
  }

  // Check for RED phase branch
  if (isRedPhaseBranch(branch)) {
    if (maybeSkipForRedPhase("branch", branch)) {
      process.exitCode = 0;
      return;
    }
  }

  // Check for scaffold branch with RED phase context
  if (isScaffoldBranch(branch)) {
    if (hasRedPhaseBranchInContext(branch)) {
      if (maybeSkipForRedPhase("context", branch)) {
        process.exitCode = 0;
        return;
      }
    }
  }

  const plan = createVerificationPlan(readPackageScripts());
  if (!plan.ok) {
    log(
      `${COLORS.red}Strict pre-push verification is not configured${COLORS.reset}`
    );
    log(plan.error);
    log("");
    log("Add one of:");
    log("  - verify:ci");
    log("  - typecheck + (check or lint) + build + test");
    process.exitCode = 1;
    return;
  }

  log(
    `Running strict verification for branch: ${COLORS.blue}${branch}${COLORS.reset}`
  );
  if (plan.source === "verify:ci") {
    log("Using `verify:ci` script.");
  } else {
    log(`Using fallback scripts: ${plan.scripts.join(" -> ")}`);
  }

  for (const scriptName of plan.scripts) {
    if (runScript(scriptName)) {
      continue;
    }

    log("");
    log(
      `${COLORS.red}Verification failed${COLORS.reset} on script: ${scriptName}`
    );
    log("");
    log("If this is intentional TDD RED phase work, name your branch:");
    log("  - feature-tests");
    log("  - feature/tests");
    log("  - feature_tests");
    process.exitCode = 1;
    return;
  }

  // TSDoc coverage summary (warning only, does not affect exit code)
  const changedFiles = getChangedFilesForPush();
  if (hasPackageSourceChanges(changedFiles)) {
    try {
      await printTsdocSummary(log);
    } catch {
      // Advisory only — never block push on TSDoc summary failure
    }
  }

  log("");
  log(`${COLORS.green}Strict verification passed${COLORS.reset}`);
  process.exitCode = 0;
}
