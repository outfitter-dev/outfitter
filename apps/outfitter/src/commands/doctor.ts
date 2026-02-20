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
import { output } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";
import { createTheme } from "@outfitter/tui/render";
import type { Command } from "commander";
import { validatePackageName } from "../engine/index.js";
import {
  getWorkspacePatterns,
  hasWorkspacesField,
} from "../engine/workspace.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

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
}

/**
 * Directories check result.
 */
export interface DirectoriesCheck {
  /** Whether src directory exists */
  readonly src: boolean;
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
  /** Whether this is a workspace root (affects which checks apply) */
  readonly isWorkspaceRoot?: boolean;
  /** Checks intentionally skipped at workspace root */
  readonly skippedChecks?: readonly string[];
  /** Per-member summary when running at a workspace root */
  readonly workspaceMembers?: readonly WorkspaceMemberHealth[];
}

/**
 * Health summary for a workspace member package.
 */
export interface WorkspaceMemberHealth {
  /** Workspace-relative member path (for example, apps/my-cli) */
  readonly path: string;
  /** Summary for the member doctor run */
  readonly summary: DoctorSummary;
  /** Member exit code (0 = pass, 1 = failed checks) */
  readonly exitCode: number;
}

interface PackageJsonReadResult {
  readonly exists: boolean;
  readonly parsed?: Record<string, unknown>;
  readonly parseError?: string;
}

// =============================================================================
// Version Comparison
// =============================================================================

const MIN_BUN_VERSION = "1.3.6";

// =============================================================================
// Individual Checks
// =============================================================================

/**
 * Checks the Bun version.
 */
function checkBunVersion(): BunVersionCheck {
  const required = MIN_BUN_VERSION;
  const current = Bun.version;

  const passed = Bun.semver.satisfies(current, `>=${required}`);

  return {
    passed,
    version: current,
    required,
    ...(passed
      ? {}
      : {
          error: `Bun version ${current} is below minimum required ${required}`,
        }),
  };
}

/**
 * Reads and parses package.json once for all doctor checks.
 */
function readPackageJson(cwd: string): PackageJsonReadResult {
  const packageJsonPath = join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { exists: false };
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    return {
      exists: true,
      parsed: JSON.parse(content) as Record<string, unknown>,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      exists: true,
      parseError: message,
    };
  }
}

/**
 * Checks if package.json exists and is valid.
 */
function checkPackageJson(
  packageJson: PackageJsonReadResult
): PackageJsonCheck {
  if (!packageJson.exists) {
    return {
      passed: false,
      error: "package.json not found in current directory",
    };
  }

  if (packageJson.parseError) {
    return {
      passed: false,
      error: `package.json is invalid JSON: ${packageJson.parseError}`,
    };
  }

  const parsed = packageJson.parsed;
  if (!parsed) {
    return {
      passed: false,
      error: "package.json is invalid JSON",
    };
  }

  // Check required fields
  if (typeof parsed["name"] !== "string" || parsed["name"].length === 0) {
    return {
      passed: false,
      error: "package.json is missing required 'name' field",
    };
  }

  if (typeof parsed["version"] !== "string" || parsed["version"].length === 0) {
    return {
      passed: false,
      error: "package.json is missing required 'version' field",
    };
  }

  const packageName = parsed["name"] as string;
  const packageVersion = parsed["version"] as string;
  const invalidPackageName = validatePackageName(packageName);
  if (invalidPackageName) {
    return {
      passed: false,
      name: packageName,
      version: packageVersion,
      error: `package.json has invalid package name '${packageName}': ${invalidPackageName}`,
    };
  }

  return {
    passed: true,
    name: packageName,
    version: packageVersion,
  };
}

/**
 * Checks if dependencies are installed.
 *
 * When `rootCwd` is provided (workspace member checks), dependencies not found
 * in the member's own `node_modules` are also looked up in the root
 * `node_modules`, since package managers hoist shared dependencies.
 */
function checkDependencies(
  cwd: string,
  packageJson: PackageJsonReadResult,
  rootCwd?: string
): DependenciesCheck {
  if (!packageJson.exists) {
    return { passed: true, count: 0 }; // No package.json means no dependencies to check
  }

  const parsed = packageJson.parsed;
  if (!parsed) {
    return { passed: true, count: 0 }; // Parsing error, assume no deps
  }

  const dependencies = parsed["dependencies"] as
    | Record<string, string>
    | undefined;
  const devDependencies = parsed["devDependencies"] as
    | Record<string, string>
    | undefined;

  // If no dependencies declared, check passes
  const allDeps = [
    ...Object.keys(dependencies ?? {}),
    ...Object.keys(devDependencies ?? {}),
  ];

  if (allDeps.length === 0) {
    return { passed: true, count: 0 };
  }

  // Check if node_modules exists (local or root)
  const nodeModulesPath = join(cwd, "node_modules");
  const rootNodeModulesPath = rootCwd ? join(rootCwd, "node_modules") : null;
  if (
    !(
      existsSync(nodeModulesPath) ||
      (rootNodeModulesPath && existsSync(rootNodeModulesPath))
    )
  ) {
    return {
      passed: false,
      count: allDeps.length,
      error:
        "node_modules not found. Run 'bun install' to install dependencies.",
    };
  }

  // Check for missing dependencies (local first, then root if hoisted)
  const missing: string[] = [];
  for (const dep of allDeps) {
    const localDepPath = join(nodeModulesPath, dep);
    if (existsSync(localDepPath)) {
      continue;
    }
    if (rootNodeModulesPath && existsSync(join(rootNodeModulesPath, dep))) {
      continue;
    }
    missing.push(dep);
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
}

/**
 * Checks for required config files.
 */
function checkConfigFiles(cwd: string): ConfigFilesCheck {
  return {
    tsconfig: existsSync(join(cwd, "tsconfig.json")),
  };
}

/**
 * Checks for required directories.
 */
function checkDirectories(cwd: string): DirectoriesCheck {
  return {
    src: existsSync(join(cwd, "src")),
  };
}

function discoverWorkspaceMemberPaths(
  cwd: string,
  packageJson: Record<string, unknown>
): readonly string[] {
  const patterns = getWorkspacePatterns(packageJson["workspaces"]);
  const memberPaths = new Set<string>();

  for (const pattern of patterns) {
    const normalizedPattern = pattern.replace(/\/+$/, "");
    const packageJsonPattern = normalizedPattern.endsWith("package.json")
      ? normalizedPattern
      : `${normalizedPattern}/package.json`;

    const glob = new Bun.Glob(packageJsonPattern);
    for (const match of glob.scanSync({ cwd, dot: false })) {
      const normalizedMatch = match.replaceAll("\\", "/");
      if (!normalizedMatch.endsWith("/package.json")) {
        continue;
      }

      const path = normalizedMatch.slice(0, -"package.json".length - 1);
      if (path.length > 0) {
        memberPaths.add(path);
      }
    }
  }

  return [...memberPaths].sort();
}

/** Check if the cwd is a workspace root (has workspaces field in package.json). */
function isWorkspaceRoot(
  packageJson: Record<string, unknown> | undefined
): boolean {
  return packageJson ? hasWorkspacesField(packageJson) : false;
}

function runDoctorForCwd(
  cwd: string,
  options: { includeWorkspaceMembers: boolean; rootCwd?: string }
): DoctorResult {
  const packageJsonRead = readPackageJson(cwd);
  const wsRoot = isWorkspaceRoot(packageJsonRead.parsed);

  // Run all checks
  const bunVersion = checkBunVersion();
  const packageJson = checkPackageJson(packageJsonRead);
  const dependencies = checkDependencies(cwd, packageJsonRead, options.rootCwd);
  const configFiles = checkConfigFiles(cwd);
  const directories = checkDirectories(cwd);
  const normalizedConfigFiles = wsRoot
    ? { ...configFiles, tsconfig: true }
    : configFiles;
  const normalizedDirectories = wsRoot
    ? { ...directories, src: true }
    : directories;

  // Calculate summary — workspace roots don't require tsconfig.json or src/
  const checkResults = wsRoot
    ? [bunVersion.passed, packageJson.passed, dependencies.passed]
    : [
        bunVersion.passed,
        packageJson.passed,
        dependencies.passed,
        configFiles.tsconfig,
        directories.src,
      ];

  const passed = checkResults.filter(Boolean).length;
  const failed = checkResults.length - passed;
  const total = checkResults.length;

  const workspaceMembers =
    options.includeWorkspaceMembers && wsRoot && packageJsonRead.parsed
      ? discoverWorkspaceMemberPaths(cwd, packageJsonRead.parsed).map(
          (path) => {
            const memberResult = runDoctorForCwd(join(cwd, path), {
              includeWorkspaceMembers: false,
              rootCwd: cwd,
            });
            return {
              path,
              summary: memberResult.summary,
              exitCode: memberResult.exitCode,
            } satisfies WorkspaceMemberHealth;
          }
        )
      : undefined;

  return {
    checks: {
      bunVersion,
      packageJson,
      dependencies,
      configFiles: normalizedConfigFiles,
      directories: normalizedDirectories,
    },
    summary: { passed, failed, total },
    exitCode: failed > 0 ? 1 : 0,
    ...(wsRoot ? { isWorkspaceRoot: true } : {}),
    ...(wsRoot
      ? {
          skippedChecks: [
            "checks.configFiles.tsconfig",
            "checks.directories.src",
          ] as const,
        }
      : {}),
    ...(workspaceMembers && workspaceMembers.length > 0
      ? { workspaceMembers }
      : {}),
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
export function runDoctor(options: DoctorOptions): DoctorResult {
  const cwd = resolve(options.cwd);
  return runDoctorForCwd(cwd, { includeWorkspaceMembers: true });
}

/**
 * Formats and outputs doctor results.
 */
export async function printDoctorResults(
  result: DoctorResult,
  options?: { mode?: OutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    await output(result, { mode: structuredMode });
    return;
  }

  const theme = createTheme();
  const lines: string[] = ["", "Outfitter Doctor", "", "=".repeat(50)];

  // Bun Version
  const bunIcon = result.checks.bunVersion.passed
    ? theme.success("[PASS]")
    : theme.error("[FAIL]");
  lines.push(
    `${bunIcon} Bun Version: ${result.checks.bunVersion.version} (requires ${result.checks.bunVersion.required})`
  );
  if (result.checks.bunVersion.error) {
    lines.push(`       ${theme.muted(result.checks.bunVersion.error)}`);
  }

  // Package.json
  const pkgIcon = result.checks.packageJson.passed
    ? theme.success("[PASS]")
    : theme.error("[FAIL]");
  lines.push(`${pkgIcon} package.json`);
  if (result.checks.packageJson.error) {
    lines.push(`       ${theme.muted(result.checks.packageJson.error)}`);
  } else if (result.checks.packageJson.name) {
    lines.push(
      `       ${theme.muted(`${result.checks.packageJson.name}@${result.checks.packageJson.version}`)}`
    );
  }

  // Dependencies
  const depsIcon = result.checks.dependencies.passed
    ? theme.success("[PASS]")
    : theme.error("[FAIL]");
  lines.push(`${depsIcon} Dependencies`);
  if (result.checks.dependencies.error) {
    lines.push(`       ${theme.muted(result.checks.dependencies.error)}`);
  } else if (result.checks.dependencies.count !== undefined) {
    lines.push(
      `       ${theme.muted(`${result.checks.dependencies.count} dependencies installed`)}`
    );
  }

  // Config Files — skip at workspace root (not applicable)
  if (result.isWorkspaceRoot) {
    lines.push(`${theme.muted("[SKIP]")} tsconfig.json`);
    lines.push(`       ${theme.muted("Not checked at workspace root")}`);
  } else {
    const tsconfigIcon = result.checks.configFiles.tsconfig
      ? theme.success("[PASS]")
      : theme.warning("[WARN]");
    lines.push(`${tsconfigIcon} tsconfig.json`);
  }

  // Directories — skip at workspace root (not applicable)
  if (result.isWorkspaceRoot) {
    lines.push(`${theme.muted("[SKIP]")} src/ directory`);
    lines.push(`       ${theme.muted("Not checked at workspace root")}`);
  } else {
    const srcIcon = result.checks.directories.src
      ? theme.success("[PASS]")
      : theme.warning("[WARN]");
    lines.push(`${srcIcon} src/ directory`);
  }

  if (result.workspaceMembers && result.workspaceMembers.length > 0) {
    lines.push("", "Members:");
    for (const member of result.workspaceMembers) {
      const memberIcon =
        member.exitCode === 0
          ? theme.success("[PASS]")
          : theme.warning("[WARN]");
      lines.push(
        `  ${memberIcon} ${member.path} ${member.summary.passed}/${member.summary.total} checks passed`
      );
    }
  }

  // Summary
  lines.push("", "=".repeat(50));
  const summaryColor = result.exitCode === 0 ? theme.success : theme.error;
  lines.push(
    summaryColor(
      `${result.summary.passed}/${result.summary.total} checks passed`
    )
  );

  if (result.exitCode !== 0) {
    lines.push(
      "",
      theme.muted("Run 'outfitter doctor' after fixing issues to verify.")
    );
  }

  await output(lines, { mode: "human" });
}

/**
 * Registers the doctor command with the CLI program.
 *
 * @deprecated Use action-registry CLI wiring via `buildCliCommands(outfitterActions, ...)`.
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
    .action(async (_flags: { json?: boolean }, command: Command) => {
      const resolvedFlags = command.optsWithGlobals<{ json?: boolean }>();
      const outputOptions = resolvedFlags.json
        ? { mode: "json" as OutputMode }
        : undefined;

      const result = runDoctor({ cwd: process.cwd() });

      await printDoctorResults(result, outputOptions);

      process.exit(result.exitCode);
    });
}
