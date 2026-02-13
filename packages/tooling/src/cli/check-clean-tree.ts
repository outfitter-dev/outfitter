/**
 * Check-clean-tree command — asserts the working tree has no modified or untracked files.
 *
 * Pure core functions for parsing git output and determining tree cleanliness.
 * The CLI runner in {@link runCheckCleanTree} handles git invocation and output.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of the working tree after verification steps */
export interface TreeStatus {
	readonly clean: boolean;
	readonly modified: string[];
	readonly untracked: string[];
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Parse `git diff --name-only` output into a list of modified file paths.
 */
export function parseGitDiff(diffOutput: string): string[] {
	return diffOutput
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

/**
 * Parse `git ls-files --others --exclude-standard` output into a list of untracked file paths.
 */
export function parseUntrackedFiles(lsOutput: string): string[] {
	return lsOutput
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

/**
 * Determine if the tree status represents a clean working tree.
 */
export function isCleanTree(status: TreeStatus): boolean {
	return status.modified.length === 0 && status.untracked.length === 0;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	dim: "\x1b[2m",
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface CheckCleanTreeOptions {
	readonly paths?: string[];
}

/**
 * Run clean-tree check against the current working directory.
 *
 * Exits 0 if clean, 1 if dirty files are found.
 */
export async function runCheckCleanTree(
	options: CheckCleanTreeOptions = {},
): Promise<void> {
	const pathArgs = options.paths ?? [];

	// Find modified tracked files (HEAD catches both staged and unstaged)
	const diffResult = Bun.spawnSync(
		["git", "diff", "HEAD", "--name-only", "--", ...pathArgs],
		{ stderr: "pipe" },
	);
	if (diffResult.exitCode !== 0) {
		process.stderr.write("Failed to run git diff\n");
		process.exit(1);
	}
	const modified = parseGitDiff(diffResult.stdout.toString());

	// Find new untracked files
	const lsResult = Bun.spawnSync(
		["git", "ls-files", "--others", "--exclude-standard", "--", ...pathArgs],
		{ stderr: "pipe" },
	);
	if (lsResult.exitCode !== 0) {
		process.stderr.write("Failed to run git ls-files\n");
		process.exit(1);
	}
	const untracked = parseUntrackedFiles(lsResult.stdout.toString());

	const clean = modified.length === 0 && untracked.length === 0;
	const status: TreeStatus = { clean, modified, untracked };

	if (status.clean) {
		process.stdout.write(
			`${COLORS.green}Working tree is clean.${COLORS.reset}\n`,
		);
		process.exit(0);
	}

	process.stderr.write(
		`${COLORS.red}Working tree is dirty after verification:${COLORS.reset}\n\n`,
	);

	if (modified.length > 0) {
		process.stderr.write("Modified files:\n");
		for (const file of modified) {
			process.stderr.write(`  ${COLORS.dim}M${COLORS.reset} ${file}\n`);
		}
	}

	if (untracked.length > 0) {
		process.stderr.write("Untracked files:\n");
		for (const file of untracked) {
			process.stderr.write(`  ${COLORS.dim}?${COLORS.reset} ${file}\n`);
		}
	}

	process.stderr.write(
		"\nThis likely means a build step produced uncommitted changes.\n",
	);
	process.stderr.write("Commit these changes or add them to .gitignore.\n");

	process.exit(1);
}
