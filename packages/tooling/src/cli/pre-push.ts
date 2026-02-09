/**
 * TDD-aware pre-push test command
 *
 * Supports TDD workflow by detecting RED phase branches (test-only changes)
 * and allowing them to push even when tests fail (by design).
 *
 * RED phase branches match: *-tests, *\/tests, *_tests
 *
 * @packageDocumentation
 */

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

/**
 * Get current git branch name
 */
function getCurrentBranch(): string {
	const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
	return result.stdout.toString().trim();
}

/**
 * Check if branch is a TDD RED phase branch
 */
function isRedPhaseBranch(branch: string): boolean {
	return (
		branch.endsWith("-tests") ||
		branch.endsWith("/tests") ||
		branch.endsWith("_tests")
	);
}

/**
 * Check if branch is a scaffold branch
 */
function isScaffoldBranch(branch: string): boolean {
	return (
		branch.endsWith("-scaffold") ||
		branch.endsWith("/scaffold") ||
		branch.endsWith("_scaffold")
	);
}

/**
 * Check if any branch in context is a RED phase branch
 */
function hasRedPhaseBranchInContext(currentBranch: string): boolean {
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

/**
 * Run the test command
 */
function runTests(): boolean {
	log("");
	const result = Bun.spawnSync(["bun", "run", "test"], {
		stdio: ["inherit", "inherit", "inherit"],
	});
	return result.exitCode === 0;
}

export interface PrePushOptions {
	force?: boolean;
}

/**
 * Main pre-push command
 */
export async function runPrePush(options: PrePushOptions = {}): Promise<void> {
	log(`${COLORS.blue}Pre-push test${COLORS.reset} (TDD-aware)`);
	log("");

	const branch = getCurrentBranch();

	// Check for RED phase branch
	if (isRedPhaseBranch(branch)) {
		log(
			`${COLORS.yellow}TDD RED phase${COLORS.reset} detected: ${COLORS.blue}${branch}${COLORS.reset}`,
		);
		log(
			`${COLORS.yellow}Skipping test execution${COLORS.reset} - tests are expected to fail in RED phase`,
		);
		log("");
		log("Remember: GREEN phase (implementation) must make these tests pass!");
		process.exit(0);
	}

	// Check for scaffold branch with RED phase context
	if (isScaffoldBranch(branch)) {
		if (hasRedPhaseBranchInContext(branch)) {
			log(
				`${COLORS.yellow}Scaffold branch${COLORS.reset} with RED phase branch in context: ${COLORS.blue}${branch}${COLORS.reset}`,
			);
			log(
				`${COLORS.yellow}Skipping test execution${COLORS.reset} - RED phase tests expected to fail`,
			);
			log("");
			process.exit(0);
		}
	}

	// Force flag bypasses tests
	if (options.force) {
		log(`${COLORS.yellow}Force flag set${COLORS.reset} - skipping tests`);
		process.exit(0);
	}

	// Normal branch - run tests
	log(`Running tests for branch: ${COLORS.blue}${branch}${COLORS.reset}`);

	if (runTests()) {
		log("");
		log(`${COLORS.green}All tests passed${COLORS.reset}`);
		process.exit(0);
	} else {
		log("");
		log(`${COLORS.red}Tests failed${COLORS.reset}`);
		log("");
		log("If this is intentional TDD RED phase work, name your branch:");
		log("  - feature-tests");
		log("  - feature/tests");
		log("  - feature_tests");
		process.exit(1);
	}
}
