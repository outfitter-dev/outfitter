/**
 * `outfitter doctor` - Validates environment and dependencies.
 *
 * Performs a series of health checks on the current project environment
 * and reports pass/fail status for each check.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { createTheme } from "@outfitter/ui";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the doctor command.
 */
export interface DoctorOptions {
	/** Working directory to check (defaults to cwd) */
	readonly cwd: string;
}

/**
 * Result of a single health check.
 */
export interface CheckResult {
	/** Whether the check passed */
	readonly passed: boolean;
	/** Error message if check failed */
	readonly error?: string;
}

/**
 * Bun version check result.
 */
export interface BunVersionCheck extends CheckResult {
	/** Current Bun version */
	readonly version: string;
	/** Required minimum version */
	readonly required: string;
}

/**
 * Package.json validation result.
 */
export interface PackageJsonCheck extends CheckResult {
	/** Package name if found */
	readonly name?: string;
	/** Package version if found */
	readonly version?: string;
}

/**
 * Dependencies check result.
 */
export interface DependenciesCheck extends CheckResult {
	/** Number of dependencies found */
	readonly count?: number;
	/** Missing dependencies if any */
	readonly missing?: readonly string[];
}

/**
 * Config files check result.
 */
export interface ConfigFilesCheck {
	/** Whether tsconfig.json exists */
	readonly tsconfig: boolean;
	/** Whether biome.json exists */
	readonly biome?: boolean;
}

/**
 * Directories check result.
 */
export interface DirectoriesCheck {
	/** Whether src directory exists */
	readonly src: boolean;
	/** Whether tests directory exists */
	readonly tests?: boolean;
}

/**
 * Summary of all checks.
 */
export interface DoctorSummary {
	/** Number of passed checks */
	readonly passed: number;
	/** Number of failed checks */
	readonly failed: number;
	/** Total number of checks */
	readonly total: number;
}

/**
 * Complete doctor result.
 */
export interface DoctorResult {
	/** Individual check results */
	readonly checks: {
		readonly bunVersion: BunVersionCheck;
		readonly packageJson: PackageJsonCheck;
		readonly dependencies: DependenciesCheck;
		readonly configFiles: ConfigFilesCheck;
		readonly directories: DirectoriesCheck;
	};
	/** Summary of all checks */
	readonly summary: DoctorSummary;
	/** Exit code (0 = all passed, 1 = some failed) */
	readonly exitCode: number;
}

// =============================================================================
// Version Comparison
// =============================================================================

/**
 * Compares two semantic version strings.
 * Returns true if `current` is >= `required`.
 */
function isVersionSatisfied(current: string, required: string): boolean {
	const parseVersion = (v: string): number[] => {
		return v.split(".").map((n) => Number.parseInt(n, 10) || 0);
	};

	const currentParts = parseVersion(current);
	const requiredParts = parseVersion(required);

	for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
		const curr = currentParts[i] ?? 0;
		const req = requiredParts[i] ?? 0;

		if (curr > req) return true;
		if (curr < req) return false;
	}

	return true; // Equal versions
}

// =============================================================================
// Individual Checks
// =============================================================================

/**
 * Checks the Bun version.
 */
function checkBunVersion(): BunVersionCheck {
	const required = "1.3.6";
	const current = Bun.version;

	const passed = isVersionSatisfied(current, required);

	return {
		passed,
		version: current,
		required,
		...(passed ? {} : { error: `Bun version ${current} is below minimum required ${required}` }),
	};
}

/**
 * Checks if package.json exists and is valid.
 */
function checkPackageJson(cwd: string): PackageJsonCheck {
	const packageJsonPath = join(cwd, "package.json");

	if (!existsSync(packageJsonPath)) {
		return {
			passed: false,
			error: "package.json not found in current directory",
		};
	}

	try {
		const content = readFileSync(packageJsonPath, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;

		// Check required fields
		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation for Record<string, unknown>
		if (typeof parsed["name"] !== "string" || parsed["name"].length === 0) {
			return {
				passed: false,
				error: "package.json is missing required 'name' field",
			};
		}

		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation for Record<string, unknown>
		if (typeof parsed["version"] !== "string" || parsed["version"].length === 0) {
			return {
				passed: false,
				error: "package.json is missing required 'version' field",
			};
		}

		return {
			passed: true,
			// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation for Record<string, unknown>
			name: parsed["name"] as string,
			// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation for Record<string, unknown>
			version: parsed["version"] as string,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			passed: false,
			error: `package.json is invalid JSON: ${message}`,
		};
	}
}

/**
 * Checks if dependencies are installed.
 */
function checkDependencies(cwd: string): DependenciesCheck {
	const packageJsonPath = join(cwd, "package.json");

	if (!existsSync(packageJsonPath)) {
		return { passed: true, count: 0 }; // No package.json means no dependencies to check
	}

	try {
		const content = readFileSync(packageJsonPath, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;

		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
		const dependencies = parsed["dependencies"] as Record<string, string> | undefined;
		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
		const devDependencies = parsed["devDependencies"] as Record<string, string> | undefined;

		// If no dependencies declared, check passes
		const allDeps = [...Object.keys(dependencies ?? {}), ...Object.keys(devDependencies ?? {})];

		if (allDeps.length === 0) {
			return { passed: true, count: 0 };
		}

		// Check if node_modules exists
		const nodeModulesPath = join(cwd, "node_modules");
		if (!existsSync(nodeModulesPath)) {
			return {
				passed: false,
				count: allDeps.length,
				error: "node_modules not found. Run 'bun install' to install dependencies.",
			};
		}

		// Check for missing dependencies
		const missing: string[] = [];
		for (const dep of allDeps) {
			const depPath = join(nodeModulesPath, dep);
			if (!existsSync(depPath)) {
				missing.push(dep);
			}
		}

		if (missing.length > 0) {
			return {
				passed: false,
				count: allDeps.length,
				missing,
				error: `Missing dependencies: ${missing.join(", ")}. Run 'bun install' to install.`,
			};
		}

		return { passed: true, count: allDeps.length };
	} catch {
		return { passed: true, count: 0 }; // Parsing error, assume no deps
	}
}

/**
 * Checks for required config files.
 */
function checkConfigFiles(cwd: string): ConfigFilesCheck {
	return {
		tsconfig: existsSync(join(cwd, "tsconfig.json")),
		biome: existsSync(join(cwd, "biome.json")),
	};
}

/**
 * Checks for required directories.
 */
function checkDirectories(cwd: string): DirectoriesCheck {
	return {
		src: existsSync(join(cwd, "src")),
		tests: existsSync(join(cwd, "src", "__tests__")) || existsSync(join(cwd, "tests")),
	};
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the doctor command programmatically.
 *
 * @param options - Doctor options
 * @returns Doctor result with all check results
 *
 * @example
 * ```typescript
 * const result = await runDoctor({ cwd: process.cwd() });
 *
 * if (result.exitCode === 0) {
 *   console.log("All checks passed!");
 * } else {
 *   console.log(`${result.summary.failed} checks failed`);
 * }
 * ```
 */
export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
	const cwd = resolve(options.cwd);

	// Run all checks
	const bunVersion = checkBunVersion();
	const packageJson = checkPackageJson(cwd);
	const dependencies = checkDependencies(cwd);
	const configFiles = checkConfigFiles(cwd);
	const directories = checkDirectories(cwd);

	// Calculate summary
	const checkResults = [
		bunVersion.passed,
		packageJson.passed,
		dependencies.passed,
		configFiles.tsconfig,
		directories.src,
	];

	const passed = checkResults.filter(Boolean).length;
	const failed = checkResults.length - passed;
	const total = checkResults.length;

	return {
		checks: {
			bunVersion,
			packageJson,
			dependencies,
			configFiles,
			directories,
		},
		summary: { passed, failed, total },
		exitCode: failed > 0 ? 1 : 0,
	};
}

/**
 * Formats and prints doctor results to the console.
 */
function printDoctorResults(result: DoctorResult): void {
	const theme = createTheme();

	// biome-ignore lint/suspicious/noConsole: CLI output is expected in this function
	console.log("\nOutfitter Doctor\n");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log("=".repeat(50));

	// Bun Version
	const bunIcon = result.checks.bunVersion.passed ? theme.success("[PASS]") : theme.error("[FAIL]");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(
		`${bunIcon} Bun Version: ${result.checks.bunVersion.version} (requires ${result.checks.bunVersion.required})`,
	);
	if (result.checks.bunVersion.error) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(`       ${theme.muted(result.checks.bunVersion.error)}`);
	}

	// Package.json
	const pkgIcon = result.checks.packageJson.passed
		? theme.success("[PASS]")
		: theme.error("[FAIL]");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(`${pkgIcon} package.json`);
	if (result.checks.packageJson.error) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(`       ${theme.muted(result.checks.packageJson.error)}`);
	} else if (result.checks.packageJson.name) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(
			`       ${theme.muted(`${result.checks.packageJson.name}@${result.checks.packageJson.version}`)}`,
		);
	}

	// Dependencies
	const depsIcon = result.checks.dependencies.passed
		? theme.success("[PASS]")
		: theme.error("[FAIL]");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(`${depsIcon} Dependencies`);
	if (result.checks.dependencies.error) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(`       ${theme.muted(result.checks.dependencies.error)}`);
	} else if (result.checks.dependencies.count !== undefined) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(
			`       ${theme.muted(`${result.checks.dependencies.count} dependencies installed`)}`,
		);
	}

	// Config Files
	const tsconfigIcon = result.checks.configFiles.tsconfig
		? theme.success("[PASS]")
		: theme.warning("[WARN]");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(`${tsconfigIcon} tsconfig.json`);

	// Directories
	const srcIcon = result.checks.directories.src ? theme.success("[PASS]") : theme.warning("[WARN]");
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(`${srcIcon} src/ directory`);

	// Summary
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(`\n${"=".repeat(50)}`);
	const summaryColor = result.exitCode === 0 ? theme.success : theme.error;
	// biome-ignore lint/suspicious/noConsole: CLI output is expected
	console.log(summaryColor(`${result.summary.passed}/${result.summary.total} checks passed`));

	if (result.exitCode !== 0) {
		// biome-ignore lint/suspicious/noConsole: CLI output is expected
		console.log(theme.muted("\nRun 'outfitter doctor' after fixing issues to verify."));
	}
}

/**
 * Registers the doctor command with the CLI program.
 *
 * @param program - Commander program instance
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { doctorCommand } from "./commands/doctor.js";
 *
 * const program = new Command();
 * doctorCommand(program);
 * ```
 */
export function doctorCommand(program: Command): void {
	program
		.command("doctor")
		.description("Validate environment and dependencies")
		.action(async () => {
			const result = await runDoctor({ cwd: process.cwd() });

			printDoctorResults(result);

			process.exit(result.exitCode);
		});
}
