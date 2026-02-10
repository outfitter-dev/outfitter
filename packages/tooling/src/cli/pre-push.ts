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

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

function runGit(args: readonly string[]): {
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

/**
 * Check if branch is a TDD RED phase branch
 */
export function isRedPhaseBranch(branch: string): boolean {
	return (
		branch.endsWith("-tests") ||
		branch.endsWith("/tests") ||
		branch.endsWith("_tests")
	);
}

/**
 * Check if branch is a scaffold branch
 */
export function isScaffoldBranch(branch: string): boolean {
	return (
		branch.endsWith("-scaffold") ||
		branch.endsWith("/scaffold") ||
		branch.endsWith("_scaffold")
	);
}

const TEST_PATH_PATTERNS = [
	/(^|\/)__tests__\//,
	/(^|\/)__snapshots__\//,
	/\.(test|spec)\.[cm]?[jt]sx?$/,
	/\.snap$/,
	/(^|\/)(vitest|jest|bun)\.config\.[cm]?[jt]s$/,
	/(^|\/)tsconfig\.test\.json$/,
	/(^|\/)\.env\.test(\.|$)/,
] as const;

export function isTestOnlyPath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/");
	return TEST_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function areFilesTestOnly(paths: readonly string[]): boolean {
	return paths.length > 0 && paths.every((path) => isTestOnlyPath(path));
}

export interface PushChangedFiles {
	readonly files: readonly string[];
	readonly deterministic: boolean;
	readonly source: "upstream" | "baseRef" | "undetermined";
}

export function canBypassRedPhaseByChangedFiles(
	changedFiles: PushChangedFiles,
): boolean {
	return changedFiles.deterministic && areFilesTestOnly(changedFiles.files);
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

function getChangedFilesForPush(): PushChangedFiles {
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

function maybeSkipForRedPhase(
	reason: "branch" | "context",
	branch: string,
): boolean {
	const changedFiles = getChangedFilesForPush();
	if (!changedFiles.deterministic) {
		log(
			`${COLORS.yellow}RED-phase bypass denied${COLORS.reset}: could not determine full push diff range`,
		);
		log("Running strict verification.");
		log("");
		return false;
	}

	if (!canBypassRedPhaseByChangedFiles(changedFiles)) {
		log(
			`${COLORS.yellow}RED-phase bypass denied${COLORS.reset}: changed files are not test-only`,
		);
		if (changedFiles.files.length > 0) {
			log(
				`Changed files (${changedFiles.source}): ${changedFiles.files.join(", ")}`,
			);
		} else {
			log(
				`No changed files detected in ${changedFiles.source} range. Running strict verification.`,
			);
		}
		log("");
		return false;
	}

	if (reason === "branch") {
		log(
			`${COLORS.yellow}TDD RED phase${COLORS.reset} detected: ${COLORS.blue}${branch}${COLORS.reset}`,
		);
	} else {
		log(
			`${COLORS.yellow}Scaffold branch${COLORS.reset} with RED phase branch in context: ${COLORS.blue}${branch}${COLORS.reset}`,
		);
	}
	log(
		`${COLORS.yellow}Skipping strict verification${COLORS.reset} - changed files are test-only`,
	);
	log(`Diff source: ${changedFiles.source}`);
	log("");
	log("Remember: GREEN phase (implementation) must make these tests pass!");
	return true;
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

type ScriptMap = Readonly<Record<string, string | undefined>>;

export type VerificationPlan =
	| {
			readonly ok: true;
			readonly scripts: readonly string[];
			readonly source: "verify:ci" | "fallback";
	  }
	| {
			readonly ok: false;
			readonly error: string;
	  };

/**
 * Derive strict pre-push verification from package scripts.
 *
 * Priority:
 * 1) `verify:ci`
 * 2) fallback sequence: `typecheck`, `check|lint`, `build`, `test`
 */
export function createVerificationPlan(scripts: ScriptMap): VerificationPlan {
	if (scripts["verify:ci"]) {
		return { ok: true, scripts: ["verify:ci"], source: "verify:ci" };
	}

	const requiredScripts = ["typecheck", "build", "test"] as const;
	const missingRequired: string[] = requiredScripts.filter(
		(name) => !scripts[name],
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

function readPackageScripts(cwd: string = process.cwd()): ScriptMap {
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

function runScript(scriptName: string): boolean {
	log("");
	log(`Running: ${COLORS.blue}bun run ${scriptName}${COLORS.reset}`);
	const result = Bun.spawnSync(["bun", "run", scriptName], {
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
	log(`${COLORS.blue}Pre-push verify${COLORS.reset} (TDD-aware)`);
	log("");

	const branch = getCurrentBranch();

	// Check for RED phase branch
	if (isRedPhaseBranch(branch)) {
		if (maybeSkipForRedPhase("branch", branch)) {
			process.exit(0);
		}
	}

	// Check for scaffold branch with RED phase context
	if (isScaffoldBranch(branch)) {
		if (hasRedPhaseBranchInContext(branch)) {
			if (maybeSkipForRedPhase("context", branch)) {
				process.exit(0);
			}
		}
	}

	// Force flag bypasses tests
	if (options.force) {
		log(
			`${COLORS.yellow}Force flag set${COLORS.reset} - skipping strict verification`,
		);
		process.exit(0);
	}

	const plan = createVerificationPlan(readPackageScripts());
	if (!plan.ok) {
		log(
			`${COLORS.red}Strict pre-push verification is not configured${COLORS.reset}`,
		);
		log(plan.error);
		log("");
		log("Add one of:");
		log("  - verify:ci");
		log("  - typecheck + (check or lint) + build + test");
		process.exit(1);
	}

	log(
		`Running strict verification for branch: ${COLORS.blue}${branch}${COLORS.reset}`,
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
			`${COLORS.red}Verification failed${COLORS.reset} on script: ${scriptName}`,
		);
		log("");
		log("If this is intentional TDD RED phase work, name your branch:");
		log("  - feature-tests");
		log("  - feature/tests");
		log("  - feature_tests");
		process.exit(1);
	}

	log("");
	log(`${COLORS.green}Strict verification passed${COLORS.reset}`);
	process.exit(0);
}
