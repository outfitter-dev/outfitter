/* eslint-disable outfitter/max-file-lines -- Changeset validation keeps repo scanning and package coverage logic together for auditability. */
/**
 * Check-changeset command — validates release-relevant package deltas include a changeset.
 *
 * Pure core functions for detecting changed packages and verifying changeset
 * presence. The CLI runner in {@link runCheckChangeset} handles git discovery
 * and output.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of checking whether changesets are required */
export interface ChangesetCheckResult {
  readonly ok: boolean;
  readonly missingFor: string[];
}

export interface ChangesetIgnoredReference {
  readonly file: string;
  readonly packages: string[];
}

interface ChangedChangesetAnalysis {
  readonly coveredPackages: string[];
  readonly ignoredReferences: ChangesetIgnoredReference[];
}

interface AnalyzedChangesetReferences {
  readonly coveredPackages: string[];
  readonly ignoredReferences: string[];
}

export interface GitDiffRange {
  readonly base: string;
  readonly head: string;
  readonly label: string;
  readonly source: "pull_request" | "default";
}

function toWorkspacePackageName(packageName: string): string {
  return packageName.startsWith("@outfitter/")
    ? packageName
    : `@outfitter/${packageName}`;
}

export function getReleasableChangedPackages(
  changedPackages: readonly string[],
  ignoredPackages: readonly string[]
): string[] {
  const ignored = new Set(ignoredPackages.map(toWorkspacePackageName));
  return changedPackages.filter(
    (packageName) => !ignored.has(toWorkspacePackageName(packageName))
  );
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Extract unique package names from changed file paths.
 *
 * Only considers release-relevant files matching the pattern
 * "packages/NAME/src/...". Test-only sources are ignored so stacked follow-up
 * PRs do not need changesets for coverage-only edits.
 *
 * @param files - List of changed file paths relative to repo root
 * @returns Sorted array of unique package names
 */
export function getChangedPackagePaths(files: string[]): string[] {
  const packageNames = new Set<string>();
  const pattern = /^packages\/([^/]+)\/src\/(.+)$/;

  for (const file of files) {
    const match = pattern.exec(file);
    if (match?.[1] && match[2] && isReleaseRelevantSourcePath(match[2])) {
      packageNames.add(match[1]);
    }
  }

  return [...packageNames].toSorted();
}

/**
 * Extract changeset filenames from changed file paths.
 *
 * Only considers files matching `.changeset/*.md`, excluding README.md.
 * This checks the git diff rather than disk, ensuring only changesets added
 * in the current PR are counted.
 *
 * @param files - List of changed file paths relative to repo root
 * @returns Array of changeset filenames (e.g. `["happy-turtle.md"]`)
 */
export function getChangedChangesetFiles(files: string[]): string[] {
  const pattern = /^\.changeset\/([^/]+\.md)$/;
  const results: string[] = [];

  for (const file of files) {
    const match = pattern.exec(file);
    if (match?.[1] && match[1] !== "README.md") {
      results.push(match[1]);
    }
  }

  return results.toSorted();
}

/**
 * Determine whether releasable packages are fully covered by the current PR changesets.
 *
 * Returns `ok: true` when either no releasable packages changed or every
 * releasable package is mentioned in at least one changed changeset file.
 * Returns `ok: false` with the list of uncovered releasable packages when
 * changeset coverage is incomplete.
 *
 * @param releasablePackages - Changed packages that are not ignored by changeset config
 * @param changesetFiles - Changeset filenames found in `.changeset/`
 * @param coveredPackages - Workspace package names referenced by the changed changesets
 */
export function checkChangesetRequired(
  releasablePackages: string[],
  changesetFiles: string[],
  coveredPackages: string[] = []
): ChangesetCheckResult {
  if (releasablePackages.length === 0) {
    return { ok: true, missingFor: [] };
  }

  if (changesetFiles.length === 0) {
    return { ok: false, missingFor: releasablePackages };
  }

  const covered = new Set(coveredPackages);
  const missingFor = releasablePackages.filter(
    (packageName) => !covered.has(toWorkspacePackageName(packageName))
  );

  return missingFor.length === 0
    ? { ok: true, missingFor: [] }
    : { ok: false, missingFor };
}

export function parseIgnoredPackagesFromChangesetConfig(
  jsonContent: string
): string[] {
  try {
    const parsed = JSON.parse(jsonContent) as { ignore?: unknown };
    if (!Array.isArray(parsed.ignore)) {
      return [];
    }

    return parsed.ignore.filter(
      (entry): entry is string => typeof entry === "string"
    );
  } catch {
    return [];
  }
}

export function parseChangesetFrontmatterPackageNames(
  markdownContent: string
): string[] {
  const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdownContent);
  if (!frontmatterMatch?.[1]) {
    return [];
  }

  const packages = new Set<string>();
  for (const line of frontmatterMatch[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = /^(["']?)(@[^"':\s]+\/[^"':\s]+)\1\s*:/.exec(trimmed);
    if (match?.[2]) {
      packages.add(match[2]);
    }
  }

  return [...packages].toSorted();
}

function isReleaseRelevantSourcePath(relativePath: string): boolean {
  if (/(^|\/)__tests__\//.test(relativePath)) {
    return false;
  }

  if (/(^|\/)__snapshots__\//.test(relativePath)) {
    return false;
  }

  if (/\.(test|spec)\.[^/]+$/.test(relativePath)) {
    return false;
  }

  return true;
}

function getDefaultGitDiffRange(): GitDiffRange {
  return {
    base: "origin/main",
    head: "HEAD",
    label: "origin/main...HEAD",
    source: "default",
  };
}

export function resolveGitDiffRange(input: {
  readonly eventName?: string | undefined;
  readonly eventPath?: string | undefined;
  readonly readEventFile?: ((path: string) => string) | undefined;
}): GitDiffRange {
  if (input.eventName !== "pull_request" || !input.eventPath) {
    return getDefaultGitDiffRange();
  }

  const readEventFile =
    input.readEventFile ?? ((path: string) => readFileSync(path, "utf-8"));

  try {
    const payload = JSON.parse(readEventFile(input.eventPath)) as {
      pull_request?: {
        base?: { ref?: string; sha?: string };
        head?: { ref?: string; sha?: string };
      };
    };

    const baseRef = payload.pull_request?.base?.ref;
    const baseSha = payload.pull_request?.base?.sha;
    const headRef = payload.pull_request?.head?.ref;
    const headSha = payload.pull_request?.head?.sha;

    if (!baseSha || !headSha) {
      return getDefaultGitDiffRange();
    }

    return {
      base: baseSha,
      head: headSha,
      label: `${baseRef ?? "base"} (${baseSha})...${headRef ?? "head"} (${headSha})`,
      source: "pull_request",
    };
  } catch {
    return getDefaultGitDiffRange();
  }
}

function analyzeChangesetReferences(
  referencedPackages: readonly string[],
  ignored: ReadonlySet<string>
): AnalyzedChangesetReferences {
  const coveredPackages = referencedPackages.filter(
    (packageName) => !ignored.has(packageName)
  );
  const ignoredReferences = referencedPackages.filter((packageName) =>
    ignored.has(packageName)
  );

  return {
    coveredPackages: coveredPackages.toSorted(),
    ignoredReferences: ignoredReferences.toSorted(),
  };
}

export function findIgnoredPackageReferences(input: {
  readonly changesetFiles: readonly string[];
  readonly ignoredPackages: readonly string[];
  readonly readChangesetFile: (filename: string) => string;
}): ChangesetIgnoredReference[] {
  if (input.ignoredPackages.length === 0 || input.changesetFiles.length === 0) {
    return [];
  }

  const ignored = new Set(input.ignoredPackages);
  const results: ChangesetIgnoredReference[] = [];

  for (const file of input.changesetFiles) {
    const content = input.readChangesetFile(file);
    const referencedPackages = parseChangesetFrontmatterPackageNames(content);
    const invalidReferences = analyzeChangesetReferences(
      referencedPackages,
      ignored
    ).ignoredReferences;
    if (invalidReferences.length > 0) {
      results.push({ file, packages: invalidReferences.toSorted() });
    }
  }

  return results.toSorted((a, b) => a.file.localeCompare(b.file));
}

function loadIgnoredPackages(cwd: string): string[] {
  const configPath = join(cwd, ".changeset", "config.json");
  if (!existsSync(configPath)) {
    return [];
  }

  try {
    return parseIgnoredPackagesFromChangesetConfig(
      readFileSync(configPath, "utf-8")
    );
  } catch {
    return [];
  }
}

function analyzeChangedChangesets(
  cwd: string,
  changesetFiles: readonly string[],
  ignoredPackages: readonly string[]
): ChangedChangesetAnalysis {
  const covered = new Set<string>();
  const ignored = new Set(ignoredPackages);
  const ignoredReferences: ChangesetIgnoredReference[] = [];

  for (const filename of changesetFiles) {
    try {
      const content = readFileSync(join(cwd, ".changeset", filename), "utf-8");
      const referencedPackages = parseChangesetFrontmatterPackageNames(content);
      const analysis = analyzeChangesetReferences(referencedPackages, ignored);

      for (const packageName of analysis.coveredPackages) {
        covered.add(packageName);
      }

      if (analysis.ignoredReferences.length > 0) {
        ignoredReferences.push({
          file: filename,
          packages: analysis.ignoredReferences,
        });
      }
    } catch {
      continue;
    }
  }

  return {
    coveredPackages: [...covered].toSorted(),
    ignoredReferences: ignoredReferences.toSorted((a, b) =>
      a.file.localeCompare(b.file)
    ),
  };
}

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
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface CheckChangesetOptions {
  readonly skip?: boolean;
}

/**
 * Run check-changeset to verify PRs include changeset files.
 *
 * Uses `git diff --name-only origin/main...HEAD` to detect changed files,
 * then checks for changeset presence when package source files are modified.
 *
 * Skips silently when:
 * - `NO_CHANGESET=1` env var is set
 * - `--skip` flag is passed
 * - `GITHUB_EVENT_NAME=push` (post-merge on main)
 * - No packages have source changes
 * - Git diff fails (local dev without origin)
 */
export async function runCheckChangeset(
  options: CheckChangesetOptions = {}
): Promise<void> {
  // Skip via flag or env var
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: CLI script reads env at startup
  if (options.skip || process.env["NO_CHANGESET"] === "1") {
    process.stdout.write(
      `${COLORS.dim}check-changeset skipped (NO_CHANGESET=1)${COLORS.reset}\n`
    );
    process.exitCode = 0;
    return;
  }

  // Skip on post-merge pushes to main
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: CLI script reads env at startup
  if (process.env["GITHUB_EVENT_NAME"] === "push") {
    process.stdout.write(
      `${COLORS.dim}check-changeset skipped (push event)${COLORS.reset}\n`
    );
    process.exitCode = 0;
    return;
  }

  // Get changed files from git using array-based spawn (safe from injection)
  const cwd = process.cwd();
  const diffRange = resolveGitDiffRange({
    // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: CLI script reads env at startup
    eventName: process.env["GITHUB_EVENT_NAME"],
    // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: CLI script reads env at startup
    eventPath: process.env["GITHUB_EVENT_PATH"],
    readEventFile: (path) => readFileSync(path, "utf-8"),
  });
  let changedFiles: string[];
  try {
    const proc = Bun.spawnSync(
      ["git", "diff", "--name-only", `${diffRange.base}...${diffRange.head}`],
      { cwd }
    );
    if (proc.exitCode !== 0) {
      // Git diff failed -- likely local dev without origin, pass silently
      process.exitCode = 0;
      return;
    }
    changedFiles = proc.stdout
      .toString()
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    // Git not available or other error -- pass silently
    process.exitCode = 0;
    return;
  }

  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: CLI script reads env at startup
  if (process.env["GITHUB_EVENT_NAME"]) {
    process.stdout.write(
      `${COLORS.dim}check-changeset diff basis: ${diffRange.label}${COLORS.reset}\n`
    );
  }

  const changedPackages = getChangedPackagePaths(changedFiles);

  if (changedPackages.length === 0) {
    process.stdout.write(
      `${COLORS.green}No package source changes detected.${COLORS.reset}\n`
    );
    process.exitCode = 0;
    return;
  }

  const changesetFiles = getChangedChangesetFiles(changedFiles);
  const ignoredPackages = loadIgnoredPackages(cwd);
  const releasablePackages = getReleasableChangedPackages(
    changedPackages,
    ignoredPackages
  );
  const changesetAnalysis = analyzeChangedChangesets(
    cwd,
    changesetFiles,
    ignoredPackages
  );
  const check = checkChangesetRequired(
    releasablePackages,
    changesetFiles,
    changesetAnalysis.coveredPackages
  );
  const ignoredReferences = changesetAnalysis.ignoredReferences;
  let hasErrors = false;

  if (!check.ok) {
    process.stderr.write(
      `${COLORS.red}Changeset coverage missing.${COLORS.reset} ` +
        "Every changed releasable package must be mentioned in at least one current PR changeset.\n\n"
    );
    process.stderr.write("Packages missing changeset coverage:\n\n");

    for (const pkg of check.missingFor) {
      process.stderr.write(
        `  ${COLORS.yellow}${toWorkspacePackageName(pkg)}${COLORS.reset}\n`
      );
    }

    process.stderr.write(
      `\nRun ${COLORS.blue}bun run changeset${COLORS.reset} for a custom changelog entry, ` +
        `or add ${COLORS.blue}release:none${COLORS.reset} to skip.\n`
    );
    hasErrors = true;
  }

  if (ignoredReferences.length > 0) {
    process.stderr.write(
      `${COLORS.red}Invalid changeset package reference(s).${COLORS.reset}\n\n`
    );
    process.stderr.write(
      "Changesets must not reference packages listed in .changeset/config.json ignore:\n\n"
    );

    for (const reference of ignoredReferences) {
      process.stderr.write(
        `  ${COLORS.yellow}${reference.file}${COLORS.reset}\n`
      );
      for (const pkg of reference.packages) {
        process.stderr.write(`    - ${pkg}\n`);
      }
    }

    process.stderr.write(
      `\nUpdate the affected changeset files to remove ignored packages before merging.\n`
    );
    hasErrors = true;
  }

  if (hasErrors) {
    process.exitCode = 1;
    return;
  }

  if (releasablePackages.length === 0) {
    process.stdout.write(
      `${COLORS.green}Only ignored package source changes detected.${COLORS.reset}\n`
    );
  } else {
    process.stdout.write(
      `${COLORS.green}Changesets cover ${releasablePackages.length} changed package(s).${COLORS.reset}\n`
    );
  }
  process.exitCode = 0;
}
