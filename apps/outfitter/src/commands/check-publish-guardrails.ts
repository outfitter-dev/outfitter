import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

export const REQUIRED_PREPUBLISH_ONLY =
  "bun ../../scripts/check-publish-manifest.ts";

const WORKSPACE_DIRS = ["packages", "apps", "plugins"] as const;

interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
}

export interface WorkspacePackageManifest {
  manifest: PackageJson;
  path: string;
}

export interface PublishGuardrailViolation {
  actual: string | undefined;
  expected: string;
  packageName: string;
  path: string;
}

export interface CheckPublishGuardrailsOptions {
  readonly cwd: string;
}

export interface CheckPublishGuardrailsResult {
  readonly checkedManifestCount: number;
  readonly ok: boolean;
  readonly violations: readonly PublishGuardrailViolation[];
  readonly workspaceRoot: string;
}

export class CheckPublishGuardrailsError extends Error {
  readonly _tag = "CheckPublishGuardrailsError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckPublishGuardrailsError";
  }
}

function readManifest(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function listWorkspacePackageManifests(
  cwd: string
): WorkspacePackageManifest[] {
  const manifests: WorkspacePackageManifest[] = [];

  for (const workspaceDirName of WORKSPACE_DIRS) {
    const workspaceDir = join(cwd, workspaceDirName);
    if (!existsSync(workspaceDir)) {
      continue;
    }

    for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = join(workspaceDir, entry.name, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }

      manifests.push({
        path: manifestPath,
        manifest: readManifest(manifestPath),
      });
    }
  }

  return manifests;
}

function isPublishablePackage(manifest: PackageJson): boolean {
  return manifest.private !== true;
}

export function findPublishGuardrailViolations(
  packages: WorkspacePackageManifest[]
): PublishGuardrailViolation[] {
  const violations: PublishGuardrailViolation[] = [];

  for (const pkg of packages) {
    if (!isPublishablePackage(pkg.manifest)) {
      continue;
    }

    const actual = pkg.manifest.scripts?.["prepublishOnly"];
    if (actual === REQUIRED_PREPUBLISH_ONLY) {
      continue;
    }

    violations.push({
      packageName: pkg.manifest.name ?? pkg.path,
      path: pkg.path,
      expected: REQUIRED_PREPUBLISH_ONLY,
      actual,
    });
  }

  return violations;
}

function formatActual(actual: string | undefined): string {
  return typeof actual === "string" ? actual : "<missing>";
}

export async function runCheckPublishGuardrails(
  options: CheckPublishGuardrailsOptions
): Promise<Result<CheckPublishGuardrailsResult, CheckPublishGuardrailsError>> {
  try {
    const workspaceRoot = resolve(options.cwd);
    const packages = listWorkspacePackageManifests(workspaceRoot);
    const violations = findPublishGuardrailViolations(packages);

    return Result.ok({
      workspaceRoot,
      checkedManifestCount: packages.length,
      violations,
      ok: violations.length === 0,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check publish guardrails";
    return Result.err(new CheckPublishGuardrailsError(message));
  }
}

export async function printCheckPublishGuardrailsResult(
  result: CheckPublishGuardrailsResult,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    const serialized =
      structuredMode === "json"
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);
    process.stdout.write(`${serialized}\n`);
    return;
  }

  if (result.ok) {
    process.stdout.write(
      `[publish-guardrails] checked ${result.checkedManifestCount} workspace manifests; all publishable packages enforce prepublishOnly guard\n`
    );
    return;
  }

  const details = result.violations
    .map(
      (violation) =>
        `- ${violation.packageName} (${violation.path}): prepublishOnly=${formatActual(violation.actual)}; expected=${violation.expected}`
    )
    .join("\n");

  process.stderr.write(
    [
      `[publish-guardrails] found ${result.violations.length} publish guardrail violation(s)`,
      details,
      "",
      "Every non-private package must set scripts.prepublishOnly to run check-publish-manifest.",
    ].join("\n")
  );
  process.stderr.write("\n");
}

interface ParsedCliArgs {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  let cwd = process.cwd();
  let outputMode: CliOutputMode = "human";

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--cwd") {
      const value = argv[index + 1];
      if (!value) {
        throw new CheckPublishGuardrailsError("Missing value for --cwd");
      }
      cwd = value;
      index += 1;
      continue;
    }

    if (arg === "--json") {
      outputMode = "json";
      continue;
    }

    if (arg === "--jsonl") {
      outputMode = "jsonl";
      continue;
    }
  }

  return {
    cwd: resolve(cwd),
    outputMode,
  };
}

export async function runCheckPublishGuardrailsFromArgv(
  argv: readonly string[]
): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid command arguments";
    process.stderr.write(`${message}\n`);
    return 1;
  }

  const result = await runCheckPublishGuardrails({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckPublishGuardrailsResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckPublishGuardrailsFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
