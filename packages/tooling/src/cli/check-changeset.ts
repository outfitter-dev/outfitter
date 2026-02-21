/**
 * Check-changeset command — validates PRs touching package source include a changeset.
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

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Extract unique package names from changed file paths.
 *
 * Only considers files matching the pattern "packages/NAME/src/..." and
 * ignores apps/, root files, and package-level config.
 *
 * @param files - List of changed file paths relative to repo root
 * @returns Sorted array of unique package names
 */
export function getChangedPackagePaths(files: string[]): string[] {
	const packageNames = new Set<string>();
	const pattern = /^packages\/([^/]+)\/src\//;

	for (const file of files) {
		const match = pattern.exec(file);
		if (match?.[1]) {
			packageNames.add(match[1]);
		}
	}

	return [...packageNames].sort();
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

	return results.sort();
}

/**
 * Determine whether a changeset is required and present.
 *
 * Returns `ok: true` when either no packages were changed or at least one
 * changeset file exists. Returns `ok: false` with the list of changed
 * packages when changesets are missing.
 *
 * @param changedPackages - Package names with source changes
 * @param changesetFiles - Changeset filenames found in `.changeset/`
 */
export function checkChangesetRequired(
	changedPackages: string[],
	changesetFiles: string[],
): ChangesetCheckResult {
	if (changedPackages.length === 0) {
		return { ok: true, missingFor: [] };
	}

	if (changesetFiles.length > 0) {
		return { ok: true, missingFor: [] };
	}

	return { ok: false, missingFor: changedPackages };
}

export function parseIgnoredPackagesFromChangesetConfig(
	jsonContent: string,
): string[] {
	try {
		const parsed = JSON.parse(jsonContent) as { ignore?: unknown };
		if (!Array.isArray(parsed.ignore)) {
			return [];
		}

		return parsed.ignore.filter(
			(entry): entry is string => typeof entry === "string",
		);
	} catch {
		return [];
	}
}

export function parseChangesetFrontmatterPackageNames(
	markdownContent: string,
): string[] {
	const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(markdownContent);
	if (!frontmatterMatch?.[1]) {
		return [];
	}

	const packages = new Set<string>();
	for (const line of frontmatterMatch[1].split("\n")) {
		const trimmed = line.trim();
		const match = /^(["']?)(@[^"':\s]+\/[^"':\s]+)\1\s*:/.exec(trimmed);
		if (match?.[2]) {
			packages.add(match[2]);
		}
	}

	return [...packages].sort();
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
		const invalidReferences = referencedPackages.filter((pkg) =>
			ignored.has(pkg),
		);
		if (invalidReferences.length > 0) {
			results.push({ file, packages: invalidReferences.sort() });
		}
	}

	return results.sort((a, b) => a.file.localeCompare(b.file));
}

function loadIgnoredPackages(cwd: string): string[] {
	const configPath = join(cwd, ".changeset", "config.json");
	if (!existsSync(configPath)) {
		return [];
	}

	try {
		return parseIgnoredPackagesFromChangesetConfig(
			readFileSync(configPath, "utf-8"),
		);
	} catch {
		return [];
	}
}

function getIgnoredReferencesForChangedChangesets(
	cwd: string,
	changesetFiles: readonly string[],
): ChangesetIgnoredReference[] {
	const ignoredPackages = loadIgnoredPackages(cwd);
	return findIgnoredPackageReferences({
		changesetFiles,
		ignoredPackages,
		readChangesetFile: (filename) =>
			readFileSync(join(cwd, ".changeset", filename), "utf-8"),
	});
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
	options: CheckChangesetOptions = {},
): Promise<void> {
	// Skip via flag or env var
	if (options.skip || process.env["NO_CHANGESET"] === "1") {
		process.stdout.write(
			`${COLORS.dim}check-changeset skipped (NO_CHANGESET=1)${COLORS.reset}\n`,
		);
		process.exit(0);
	}

	// Skip on post-merge pushes to main
	if (process.env["GITHUB_EVENT_NAME"] === "push") {
		process.stdout.write(
			`${COLORS.dim}check-changeset skipped (push event)${COLORS.reset}\n`,
		);
		process.exit(0);
	}

	// Get changed files from git using array-based spawn (safe from injection)
	const cwd = process.cwd();
	let changedFiles: string[];
	try {
		const proc = Bun.spawnSync(
			["git", "diff", "--name-only", "origin/main...HEAD"],
			{ cwd },
		);
		if (proc.exitCode !== 0) {
			// Git diff failed -- likely local dev without origin, pass silently
			process.exit(0);
		}
		changedFiles = proc.stdout
			.toString()
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);
	} catch {
		// Git not available or other error -- pass silently
		process.exit(0);
	}

	const changedPackages = getChangedPackagePaths(changedFiles);

	if (changedPackages.length === 0) {
		process.stdout.write(
			`${COLORS.green}No package source changes detected.${COLORS.reset}\n`,
		);
		process.exit(0);
	}

	const changesetFiles = getChangedChangesetFiles(changedFiles);
	const check = checkChangesetRequired(changedPackages, changesetFiles);

	if (!check.ok) {
		// Fail with actionable error
		process.stderr.write(`${COLORS.red}Missing changeset!${COLORS.reset}\n\n`);
		process.stderr.write(
			"The following packages have source changes but no changeset:\n\n",
		);

		for (const pkg of check.missingFor) {
			process.stderr.write(
				`  ${COLORS.yellow}@outfitter/${pkg}${COLORS.reset}\n`,
			);
		}

		process.stderr.write(
			`\nRun ${COLORS.blue}bun run changeset${COLORS.reset} to add a changeset, ` +
				`or add the ${COLORS.blue}no-changeset${COLORS.reset} label to skip.\n`,
		);

		process.exit(1);
	}

	const ignoredReferences = getIgnoredReferencesForChangedChangesets(
		cwd,
		changesetFiles,
	);
	if (ignoredReferences.length > 0) {
		process.stderr.write(
			`${COLORS.red}Invalid changeset package reference(s).${COLORS.reset}\n\n`,
		);
		process.stderr.write(
			"Changesets must not reference packages listed in .changeset/config.json ignore:\n\n",
		);

		for (const reference of ignoredReferences) {
			process.stderr.write(
				`  ${COLORS.yellow}${reference.file}${COLORS.reset}\n`,
			);
			for (const pkg of reference.packages) {
				process.stderr.write(`    - ${pkg}\n`);
			}
		}

		process.stderr.write(
			`\nUpdate the affected changeset files to remove ignored packages before merging.\n`,
		);
		process.exit(1);
	}

	process.stdout.write(
		`${COLORS.green}Changeset found for ${changedPackages.length} changed package(s).${COLORS.reset}\n`,
	);
	process.exit(0);
}
