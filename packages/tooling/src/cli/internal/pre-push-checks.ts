/* eslint-disable outfitter/max-file-lines -- Pre-push check helpers remain grouped so hook behavior is easier to audit. */
/**
 * Individual check functions and helpers for pre-push verification.
 *
 * Contains branch detection, test-path analysis, changed-file resolution,
 * Bun version checking, verification plan construction, and TDD RED-phase
 * bypass logic.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import ts from "typescript";

import { analyzeSourceFile, calculateCoverage } from "./tsdoc-analysis.js";
import type { DeclarationCoverage } from "./tsdoc-types.js";

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/** Get current git branch name */
export function getCurrentBranch(): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
  return result.stdout.toString().trim();
}

export function runGit(args: readonly string[]): {
  readonly ok: boolean;
  readonly lines: readonly string[];
} {
  try {
    const result = Bun.spawnSync(["git", ...args], { stderr: "ignore" });
    if (result.exitCode !== 0) {
      return { ok: false, lines: [] };
    }

    return {
      ok: true,
      lines: result.stdout
        .toString()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
  } catch {
    return { ok: false, lines: [] };
  }
}

// ---------------------------------------------------------------------------
// Branch detection
// ---------------------------------------------------------------------------

/** Check if branch is a TDD RED phase branch */
export function isRedPhaseBranch(branch: string): boolean {
  return (
    branch.endsWith("-tests") ||
    branch.endsWith("/tests") ||
    branch.endsWith("_tests")
  );
}

/** Check if branch is a scaffold branch */
export function isScaffoldBranch(branch: string): boolean {
  return (
    branch.endsWith("-scaffold") ||
    branch.endsWith("/scaffold") ||
    branch.endsWith("_scaffold")
  );
}

/** Check if branch is a changeset release branch */
export function isReleaseBranch(branch: string): boolean {
  return branch.startsWith("changeset-release/");
}

// ---------------------------------------------------------------------------
// Test-path analysis
// ---------------------------------------------------------------------------

const TEST_PATH_PATTERNS = [
  /(^|\/)__tests__\//,
  /(^|\/)__snapshots__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\.snap$/,
  /(^|\/)(vitest|jest|bun)\.config\.[cm]?[jt]s$/,
  /(^|\/)tsconfig\.test\.json$/,
  /(^|\/)\.env\.test(\.|$)/,
] as const;

/** Determine if a file path is test-related */
export function isTestOnlyPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return TEST_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Check if all paths in the list are test-related */
export function areFilesTestOnly(paths: readonly string[]): boolean {
  return paths.length > 0 && paths.every((path) => isTestOnlyPath(path));
}

// ---------------------------------------------------------------------------
// Changed-file resolution
// ---------------------------------------------------------------------------

export interface PushChangedFiles {
  readonly files: readonly string[];
  readonly deterministic: boolean;
  readonly source: "upstream" | "baseRef" | "undetermined";
}

/** Check if bypass is safe: deterministic range with test-only changes */
export function canBypassRedPhaseByChangedFiles(
  changedFiles: PushChangedFiles
): boolean {
  return changedFiles.deterministic && areFilesTestOnly(changedFiles.files);
}

/**
 * Check whether any changed files are package source files.
 *
 * Matches files under "packages/PKGNAME/src/" (any depth).
 */
export function hasPackageSourceChanges(
  changedFiles: PushChangedFiles
): boolean {
  const packageSrcPattern = /^packages\/[^/]+\/src\//;
  return changedFiles.files.some((f) => packageSrcPattern.test(f));
}

function resolveBaseRef(): string | undefined {
  const candidates = [
    "origin/main",
    "main",
    "origin/trunk",
    "trunk",
    "origin/master",
    "master",
  ] as const;

  for (const candidate of candidates) {
    const resolved = runGit(["rev-parse", "--verify", "--quiet", candidate]);
    if (resolved.ok) {
      return candidate;
    }
  }

  return undefined;
}

function changedFilesFromRange(range: string): {
  readonly ok: boolean;
  readonly files: readonly string[];
} {
  const result = runGit(["diff", "--name-only", "--diff-filter=d", range]);
  return {
    ok: result.ok,
    files: result.lines,
  };
}

/** Determine which files have changed for the current push */
export function getChangedFilesForPush(): PushChangedFiles {
  const upstream = runGit([
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]);
  if (upstream.ok && upstream.lines[0]) {
    const rangeResult = changedFilesFromRange(`${upstream.lines[0]}...HEAD`);
    if (rangeResult.ok) {
      return {
        files: rangeResult.files,
        deterministic: true,
        source: "upstream",
      };
    }
  }

  const baseRef = resolveBaseRef();
  if (baseRef) {
    const rangeResult = changedFilesFromRange(`${baseRef}...HEAD`);
    if (rangeResult.ok) {
      return {
        files: rangeResult.files,
        deterministic: true,
        source: "baseRef",
      };
    }
  }

  return {
    files: [],
    deterministic: false,
    source: "undetermined",
  };
}

// ---------------------------------------------------------------------------
// Change categorization for scoped verification
// ---------------------------------------------------------------------------

/**
 * Change scope categories from most to least impactful.
 *
 * - `core`: Foundation packages (contracts, types) — full suite required
 * - `runtime`: Active packages (cli, mcp, config, etc.) — full suite required
 * - `ci`: CI/workflow config — full suite required
 * - `tooling`: Tooling package itself — full suite required
 * - `app`: apps/ changes — full suite required (actions, commands)
 * - `template`: Preset templates only — lightweight lint/format + full test suite
 * - `docs`: Docs, plugins, READMEs — lightweight checks only (lint, format)
 * - `config`: Root config files (.lefthook.yml, etc.) — lightweight checks
 */
export type ChangeScope =
  | "core"
  | "runtime"
  | "ci"
  | "tooling"
  | "app"
  | "template"
  | "docs"
  | "config";

/** Result of categorizing changed files by their impact on verification scope. */
export interface ChangeCategory {
  /** The highest-impact scope found among the changed files. */
  readonly scope: ChangeScope;
  /** Whether any changed file requires running the full verification suite. */
  readonly requiresFullSuite: boolean;
}

const SCOPE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  scope: ChangeScope;
  requiresFullSuite: boolean;
}> = [
  // CI and workflow config — always full suite
  { pattern: /^\.github\//, scope: "ci", requiresFullSuite: true },
  { pattern: /^turbo\.json$/, scope: "ci", requiresFullSuite: true },

  // Foundation packages
  { pattern: /^packages\/contracts\//, scope: "core", requiresFullSuite: true },
  { pattern: /^packages\/types\//, scope: "core", requiresFullSuite: true },

  // Tooling package
  {
    pattern: /^packages\/tooling\//,
    scope: "tooling",
    requiresFullSuite: true,
  },

  // Apps (CLI, outfitter)
  { pattern: /^apps\//, scope: "app", requiresFullSuite: true },

  // Runtime packages (everything else in packages/ that isn't templates)
  {
    pattern: /^packages\/presets\/presets\/.*\.template$/,
    scope: "template",
    requiresFullSuite: false,
  },
  {
    pattern: /^packages\/presets\//,
    scope: "runtime",
    requiresFullSuite: true,
  },
  {
    pattern: /^packages\//,
    scope: "runtime",
    requiresFullSuite: true,
  },

  // Plugin executable files (scripts, hooks) need full suite
  {
    pattern: /^plugins\/.*\.(ts|tsx|js|jsx|mts|mjs|cjs|cts|sh)$/,
    scope: "app",
    requiresFullSuite: true,
  },

  // Docs, plugin non-executable files, READMEs
  { pattern: /^docs\//, scope: "docs", requiresFullSuite: false },
  { pattern: /^plugins\//, scope: "docs", requiresFullSuite: false },
  { pattern: /\.md$/i, scope: "docs", requiresFullSuite: false },

  // Root config files
  {
    pattern: /^\.(lefthook|oxlintrc|oxfmtrc|markdownlint)(\.|$)/,
    scope: "config",
    requiresFullSuite: false,
  },
  { pattern: /^scripts\//, scope: "config", requiresFullSuite: false },
];

/** Scoped impact ranking for non-full-suite change categories: template > config > docs. */
const SCOPE_RANK: Readonly<Partial<Record<ChangeScope, number>>> = {
  template: 2,
  config: 1,
  docs: 0,
};

/**
 * Categorize changed files to determine verification scope.
 *
 * Returns the highest-impact category found. If any file requires the
 * full suite, the entire push gets full verification.
 *
 * @param changedFiles - Files changed in the current push
 * @returns Category with scope name and whether full suite is required
 *
 * @example
 * ```typescript
 * const changed = getChangedFilesForPush();
 * const category = categorizeChangedFiles(changed);
 * if (!category.requiresFullSuite) {
 *   // Run lightweight checks only
 * }
 * ```
 */
export function categorizeChangedFiles(
  changedFiles: PushChangedFiles
): ChangeCategory {
  if (!changedFiles.deterministic) {
    // Can't determine changed files — run full suite to be safe.
    // Scope is "config" (not "core") to avoid misleading logs about core packages.
    return { scope: "config", requiresFullSuite: true };
  }
  if (changedFiles.files.length === 0) {
    // No files detected (tag push, empty push) — full suite as a conservative default
    return { scope: "config", requiresFullSuite: true };
  }

  let highestScope: ChangeScope | null = null;
  let highestRank = -1;

  for (const file of changedFiles.files) {
    const matched = SCOPE_PATTERNS.find((p) => p.pattern.test(file));
    if (!matched) {
      // Unknown file path — cannot determine scope, run full suite conservatively.
      // Scope is "config" (not "core") to avoid misleading logs about core packages.
      return { scope: "config", requiresFullSuite: true };
    }

    if (matched.requiresFullSuite) {
      return { scope: matched.scope, requiresFullSuite: true };
    }

    const rank = SCOPE_RANK[matched.scope] ?? 0;
    if (rank > highestRank) {
      highestRank = rank;
      highestScope = matched.scope;
    }
  }

  // highestScope is always non-null here: the files.length === 0 guard above
  // ensures the loop runs at least once, and highestRank = -1 guarantees the
  // first matched scope (rank >= 0) overwrites it.
  return { scope: highestScope as ChangeScope, requiresFullSuite: false };
}

// ---------------------------------------------------------------------------
// RED-phase bypass
// ---------------------------------------------------------------------------

/** Check if any branch in context is a RED phase branch */
export function hasRedPhaseBranchInContext(currentBranch: string): boolean {
  // Try gt ls first (Graphite may not be installed)
  let branches: string[] = [];

  try {
    const gtResult = Bun.spawnSync(["gt", "ls"], { stderr: "pipe" });
    if (gtResult.exitCode === 0) {
      branches = gtResult.stdout
        .toString()
        .split("\n")
        .map((line) => line.replace(/^[│├└─◉◯ ]*/g, "").replace(/ \(.*/, ""))
        .filter(Boolean);
    }
  } catch {
    // Graphite not installed — fall through to git branch check
  }

  // Fall back to git branches
  if (branches.length === 0) {
    const gitResult = Bun.spawnSync([
      "git",
      "branch",
      "--list",
      "cli/*",
      "types/*",
      "contracts/*",
    ]);
    branches = gitResult.stdout
      .toString()
      .split("\n")
      .map((line) => line.replace(/^[* ]+/, ""))
      .filter(Boolean);
  }

  for (const branch of branches) {
    if (branch === currentBranch) continue;
    if (isRedPhaseBranch(branch)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Verification plan
// ---------------------------------------------------------------------------

type ScriptMap = Readonly<Record<string, string | undefined>>;

export type VerificationPlan =
  | {
      readonly ok: true;
      readonly scripts: readonly string[];
      readonly source: "verify:push" | "verify:ci" | "fallback";
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

/**
 * Derive strict pre-push verification from package scripts.
 *
 * Priority:
 * 1) `verify:push`
 * 2) `verify:ci`
 * 3) fallback sequence: `typecheck`, `check|lint`, `build`, `test`
 */
export function createVerificationPlan(scripts: ScriptMap): VerificationPlan {
  if (scripts["verify:push"]) {
    return { ok: true, scripts: ["verify:push"], source: "verify:push" };
  }

  if (scripts["verify:ci"]) {
    return { ok: true, scripts: ["verify:ci"], source: "verify:ci" };
  }

  const requiredScripts = ["typecheck", "build", "test"] as const;
  const missingRequired: string[] = requiredScripts.filter(
    (name) => !scripts[name]
  );
  const checkOrLint = scripts["check"]
    ? "check"
    : scripts["lint"]
      ? "lint"
      : undefined;

  if (!checkOrLint || missingRequired.length > 0) {
    const missing = checkOrLint
      ? missingRequired
      : [...missingRequired, "check|lint"];
    return {
      ok: false,
      error: `Missing required scripts for strict pre-push verification: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true,
    scripts: ["typecheck", checkOrLint, "build", "test"],
    source: "fallback",
  };
}

/** Read and normalize scripts from package.json */
export function readPackageScripts(cwd: string = process.cwd()): ScriptMap {
  const packageJsonPath = join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      scripts?: Record<string, unknown>;
    };
    const scripts = parsed.scripts ?? {};
    const normalized: Record<string, string> = {};

    for (const [name, value] of Object.entries(scripts)) {
      if (typeof value === "string") {
        normalized[name] = value;
      }
    }

    return normalized;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Bun version check
// ---------------------------------------------------------------------------

export interface BunVersionCheckResult {
  readonly matches: boolean;
  readonly expected?: string;
  readonly actual?: string;
}

/**
 * Check that the local Bun version matches the pinned version in ".bun-version".
 *
 * @param projectRoot - Directory containing ".bun-version" (defaults to cwd)
 * @returns Result indicating whether versions match
 */
export function checkBunVersion(
  projectRoot: string = process.cwd()
): BunVersionCheckResult {
  const versionFile = join(projectRoot, ".bun-version");
  if (!existsSync(versionFile)) {
    return { matches: true };
  }

  const expected = readFileSync(versionFile, "utf-8").trim();
  const actual = Bun.version;

  if (expected === actual) {
    return { matches: true };
  }

  return { matches: false, expected, actual };
}

// ---------------------------------------------------------------------------
// TSDoc summary
// ---------------------------------------------------------------------------

/**
 * Print a one-line TSDoc coverage summary across all workspace packages.
 *
 * Discovers package entry points ("packages/STAR/src/index.ts"), analyzes
 * TSDoc coverage, and outputs a single summary line. This is advisory
 * only -- the result does not affect the exit code.
 */
export async function printTsdocSummary(
  log: (msg: string) => void
): Promise<void> {
  const glob = new Bun.Glob("packages/*/src/index.ts");
  const cwd = process.cwd();
  const allDeclarations: DeclarationCoverage[] = [];

  for (const entry of glob.scanSync({ cwd })) {
    const filePath = resolve(cwd, entry);
    const content = await Bun.file(filePath).text();
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    allDeclarations.push(...analyzeSourceFile(sourceFile));
  }

  if (allDeclarations.length === 0) return;

  const coverage = calculateCoverage(allDeclarations);
  const parts: string[] = [];
  if (coverage.documented > 0) parts.push(`${coverage.documented} documented`);
  if (coverage.partial > 0) parts.push(`${coverage.partial} partial`);
  if (coverage.undocumented > 0)
    parts.push(`${coverage.undocumented} undocumented`);

  const BLUE = "\x1b[34m";
  const RESET = "\x1b[0m";
  log(
    `${BLUE}TSDoc${RESET}: ${coverage.percentage}% coverage (${parts.join(", ")} of ${coverage.total} total)`
  );
}
