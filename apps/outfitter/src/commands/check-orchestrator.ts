/**
 * `outfitter check` orchestrator modes.
 *
 * Provides hook-aware check bundles with unified output and optional
 * clean-tree enforcement for read-only modes.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import { createTheme } from "@outfitter/tui/render";

import { resolveStructuredOutputMode } from "../output-mode.js";

export type CheckOrchestratorMode = "all" | "ci" | "pre-commit" | "pre-push";

interface CheckOrchestratorStep {
  readonly command: readonly string[];
  readonly id: string;
  readonly label: string;
}

export interface CheckOrchestratorOptions {
  readonly cwd: string;
  readonly mode: CheckOrchestratorMode;
  readonly stagedFiles?: readonly string[];
}

interface CheckOrchestratorStepResult {
  readonly command: readonly string[];
  readonly durationMs: number;
  readonly exitCode: number;
  readonly id: string;
  readonly label: string;
  readonly stderr: string;
  readonly stdout: string;
}

export interface CheckOrchestratorResult {
  readonly failedStepIds: readonly string[];
  readonly mode: CheckOrchestratorMode;
  readonly mutatedPaths: readonly string[];
  readonly ok: boolean;
  readonly steps: readonly CheckOrchestratorStepResult[];
  readonly treeClean: boolean;
}

const SUCCESS_ADVISORY_PATTERNS: readonly RegExp[] = [
  /\bwarn(?:ing)?\b/i,
  /\bno changeset found\b/i,
  /\bconsider adding one\b/i,
  /\binvalid changeset package reference\b/i,
];

export class CheckOrchestratorError extends Error {
  readonly _tag = "CheckOrchestratorError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckOrchestratorError";
  }
}

function normalizePaths(paths: readonly string[] | undefined): string[] {
  if (!paths || paths.length === 0) {
    return [];
  }

  return paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .toSorted();
}

function shouldSyncAgentScaffolding(paths: readonly string[]): boolean {
  return paths.some(
    (path) =>
      path === ".claude/settings.json" || path.startsWith(".claude/hooks/")
  );
}

export function buildCheckOrchestratorPlan(
  options: CheckOrchestratorOptions
): readonly CheckOrchestratorStep[] {
  const stagedFiles = normalizePaths(options.stagedFiles);

  if (options.mode === "all" || options.mode === "ci") {
    const steps: CheckOrchestratorStep[] = [
      {
        id: "typecheck",
        label: "Typecheck",
        command: ["bun", "run", "typecheck", "--", "--only"],
      },
      {
        id: "lint-and-format",
        label: "Lint/Format checks",
        command: ["bun", "run", "check"],
      },
      {
        id: "publish-guardrails",
        label: "Publish guardrails",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/cli.ts",
          "check",
          "publish-guardrails",
          "--cwd",
          ".",
        ],
      },
      {
        id: "changeset",
        label: "Changeset",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "changeset",
          "--cwd",
          ".",
        ],
      },
      {
        id: "registry",
        label: "Bunup registry",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "registry",
          "--cwd",
          ".",
        ],
      },
      {
        id: "preset-versions",
        label: "Preset dependency versions",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/cli.ts",
          "check",
          "preset-versions",
          "--cwd",
          ".",
        ],
      },
      {
        id: "docs-sentinel",
        label: "Docs readme sentinel",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/cli.ts",
          "check",
          "docs-sentinel",
          "--cwd",
          ".",
        ],
      },
      {
        id: "docs-links",
        label: "Markdown links",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "markdown-links",
          "--cwd",
          ".",
        ],
      },
      {
        id: "exports",
        label: "Exports",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "exports",
          "--cwd",
          ".",
        ],
      },
      {
        id: "readme-imports",
        label: "README imports",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "readme",
          "--cwd",
          ".",
        ],
      },
      {
        id: "exports-normalized",
        label: "Exports normalized",
        command: ["bun", "run", "exports:check"],
      },
      {
        id: "tree-clean",
        label: "Working tree clean",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "tree",
          "--cwd",
          ".",
        ],
      },
      {
        id: "boundary-invocations",
        label: "Boundary invocations",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/commands/repo.ts",
          "check",
          "boundary-invocations",
          "--cwd",
          ".",
        ],
      },
      {
        id: "surface-map-canonical",
        label: "Surface map canonical path",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/cli.ts",
          "check",
          "surface-map",
          "--cwd",
          ".",
        ],
      },
      {
        id: "surface-map-format",
        label: "Surface map format",
        command: [
          "bun",
          "run",
          "apps/outfitter/src/cli.ts",
          "check",
          "surface-map-format",
          "--cwd",
          ".",
        ],
      },
      {
        id: "schema-diff",
        label: "Schema drift",
        command: ["bun", "run", "schema:diff"],
      },
    ];

    if (options.mode === "ci") {
      steps.push({
        id: "tests",
        label: "Tests",
        command: ["bun", "run", "test", "--", "--only"],
      });
    }

    return steps;
  }

  if (options.mode === "pre-push") {
    return [
      {
        id: "pre-push-verify",
        label: "Hook verify",
        command: [
          "bun",
          "run",
          "packages/tooling/src/cli/index.ts",
          "pre-push",
        ],
      },
      {
        id: "schema-drift",
        label: "Schema drift",
        command: ["bun", "run", "apps/outfitter/src/cli.ts", "schema", "diff"],
      },
    ];
  }

  const hasStagedFiles = stagedFiles.length > 0;
  const tsFiles = stagedFiles.filter((f) => /\.(ts|tsx)$/.test(f));

  const preCommitSteps: CheckOrchestratorStep[] = [
    {
      id: "ultracite-fix",
      label: "Ultracite fix",
      command: hasStagedFiles
        ? ["bun", "x", "ultracite", "fix", ...stagedFiles]
        : ["bun", "x", "ultracite", "fix", "."],
    },
    {
      id: "exports",
      label: "Exports",
      command: ["bun", "run", "check-exports"],
    },
  ];

  if (tsFiles.length > 0) {
    // Insert typecheck before exports (index 1)
    preCommitSteps.splice(1, 0, {
      id: "typecheck",
      label: "Typecheck",
      command: ["./scripts/pre-commit-typecheck.sh", ...tsFiles],
    });
  } else if (!hasStagedFiles) {
    // No staged files at all — full typecheck fallback
    preCommitSteps.splice(1, 0, {
      id: "typecheck",
      label: "Typecheck",
      command: ["bun", "run", "typecheck", "--", "--only"],
    });
  }

  if (shouldSyncAgentScaffolding(stagedFiles)) {
    preCommitSteps.push({
      id: "sync-agent-scaffolding",
      label: "Sync agent scaffolding",
      command: ["./scripts/sync-agent-scaffolding.sh"],
    });
  }

  return preCommitSteps;
}

export function parseTreePaths(statusOutput: string): string[] {
  return statusOutput
    .split("\n")
    .filter((line) => line.length >= 3)
    .map((line) => {
      const payload = line.slice(3).trim();
      const renameParts = payload.split(" -> ");
      return renameParts.at(-1) ?? payload;
    })
    .toSorted();
}

function readTreePaths(cwd: string): string[] {
  const result = Bun.spawnSync(["git", "status", "--porcelain"], {
    cwd,
    stderr: "ignore",
  });
  if (result.exitCode !== 0) {
    return [];
  }
  return parseTreePaths(result.stdout.toString());
}

function diffTreePaths(
  before: readonly string[],
  after: readonly string[]
): string[] {
  const beforeSet = new Set(before);
  return after.filter((path) => !beforeSet.has(path));
}

async function runStep(
  cwd: string,
  step: CheckOrchestratorStep
): Promise<CheckOrchestratorStepResult> {
  const startedAt = Date.now();
  const processHandle = Bun.spawn([...step.command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);

  return {
    id: step.id,
    label: step.label,
    command: step.command,
    exitCode,
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
  };
}

function extractSuccessAdvisory(stderr: string): string | undefined {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return undefined;
  }

  const advisoryLines = lines.filter((line) =>
    SUCCESS_ADVISORY_PATTERNS.some((pattern) => pattern.test(line))
  );
  if (advisoryLines.length === 0) {
    return undefined;
  }

  const maxLines = 3;
  const visibleLines = advisoryLines.slice(0, maxLines);
  if (advisoryLines.length > maxLines) {
    visibleLines.push(
      `...and ${advisoryLines.length - maxLines} more advisory line(s)`
    );
  }

  return visibleLines.join("\n");
}

export async function runCheckOrchestrator(
  options: CheckOrchestratorOptions
): Promise<Result<CheckOrchestratorResult, CheckOrchestratorError>> {
  try {
    const cwd = resolve(options.cwd);
    const plan = buildCheckOrchestratorPlan({ ...options, cwd });
    if (plan.length === 0) {
      return Result.err(
        new CheckOrchestratorError("No checks configured for selected mode")
      );
    }

    const treeBefore = readTreePaths(cwd);
    const stepResults: CheckOrchestratorStepResult[] = [];
    for (const step of plan) {
      const result = await runStep(cwd, step);
      stepResults.push(result);
      if (result.exitCode !== 0) {
        break;
      }
    }
    const treeAfter = readTreePaths(cwd);

    const failedStepIds = stepResults
      .filter((step) => step.exitCode !== 0)
      .map((step) => step.id);

    const mutatedPaths = diffTreePaths(treeBefore, treeAfter);
    const treeClean = mutatedPaths.length === 0;
    const enforceCleanTree = options.mode !== "pre-commit";

    return Result.ok({
      mode: options.mode,
      steps: stepResults,
      failedStepIds,
      mutatedPaths,
      treeClean,
      ok:
        failedStepIds.length === 0 &&
        (!enforceCleanTree || (enforceCleanTree && treeClean)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new CheckOrchestratorError(`Failed to run check orchestrator: ${message}`)
    );
  }
}

interface PrintCheckOrchestratorResultsOptions {
  readonly mode?: OutputMode;
}

export async function printCheckOrchestratorResults(
  result: CheckOrchestratorResult,
  options: PrintCheckOrchestratorResultsOptions = {}
): Promise<void> {
  const mode = resolveStructuredOutputMode(options.mode) ?? "human";
  if (mode === "json" || mode === "jsonl") {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const theme = createTheme();
  process.stdout.write(
    `${theme.bold("Check Orchestrator")} (${result.mode})\n\n`
  );

  for (const step of result.steps) {
    const icon = step.exitCode === 0 ? theme.success("✓") : theme.error("✗");
    const duration = `${step.durationMs}ms`;
    process.stdout.write(
      `  ${icon} ${step.label} ${theme.muted(`(${duration})`)}\n`
    );

    if (step.exitCode !== 0) {
      const snippet = `${step.stdout}\n${step.stderr}`.trim();
      if (snippet.length > 0) {
        process.stdout.write(`${theme.muted(snippet)}\n`);
      }
    } else {
      const advisory = extractSuccessAdvisory(step.stderr);
      if (advisory) {
        process.stdout.write(
          `    ${theme.warning("!")} ${theme.muted(advisory)}\n`
        );
      }
    }
  }

  if (!result.treeClean) {
    process.stdout.write(
      `\n${theme.warning("Mutation traceability")}: working tree changed during run\n`
    );
    for (const path of result.mutatedPaths) {
      process.stdout.write(`  ${theme.muted(path)}\n`);
    }
  }

  process.stdout.write("\n");
  if (result.ok) {
    process.stdout.write(
      `${theme.success("All orchestrated checks passed.")}\n`
    );
  } else {
    process.stdout.write(
      `${theme.error("Orchestrated checks failed.")} ${theme.muted(`(${result.failedStepIds.join(", ") || "tree-clean"})`)}\n`
    );
  }
}
