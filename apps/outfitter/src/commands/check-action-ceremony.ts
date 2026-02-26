import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

const ACTIONS_RELATIVE_DIR = "apps/outfitter/src/actions";

interface CeremonyBudget {
  readonly description: string;
  readonly id: string;
  readonly maxCount: number;
  readonly pattern: RegExp;
}

const CEREMONY_BUDGETS: readonly CeremonyBudget[] = [
  {
    id: "direct-defineAction-generics",
    description:
      "Direct defineAction<T> invocations should stay constrained (prefer export-level typing)",
    maxCount: 1,
    pattern: /(?<!typeof\s)defineAction</g,
  },
  {
    id: "schema-zodtype-casts",
    description:
      "Action-local schema casts should not expand without justification",
    maxCount: 6,
    pattern: /as z\.ZodType</g,
  },
  {
    id: "direct-internalerror-construction",
    description:
      "Direct InternalError creation in action handlers should stay minimal (use shared adapter)",
    maxCount: 1,
    pattern: /new InternalError\(/g,
  },
];

type CeremonyBudgetId = (typeof CEREMONY_BUDGETS)[number]["id"];

/** Options for the action-ceremony guardrail check. */
export interface CheckActionCeremonyOptions {
  /** Workspace root used to locate the actions directory. */
  readonly cwd: string;
}

/** Result for a single ceremony budget after scanning action sources. */
export interface CeremonyBudgetResult {
  /** Number of pattern occurrences found. */
  readonly count: number;
  readonly description: string;
  readonly id: string;
  /** Maximum allowed occurrences before the budget is exceeded. */
  readonly maxCount: number;
  /** Whether the count is within the allowed budget. */
  readonly ok: boolean;
}

/** Aggregate result of the action-ceremony check across all budgets. */
export interface CheckActionCeremonyResult {
  /** Resolved path to the scanned actions directory. */
  readonly actionsDir: string;
  readonly budgets: readonly CeremonyBudgetResult[];
  /** True when every budget is within its allowed count. */
  readonly ok: boolean;
}

/** Error raised when the action-ceremony check cannot complete. */
export class CheckActionCeremonyError extends Error {
  readonly _tag = "CheckActionCeremonyError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckActionCeremonyError";
  }
}

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function readActionSources(actionsDir: string): readonly string[] {
  return readdirSync(actionsDir)
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => resolve(actionsDir, entry));
}

/**
 * Scan action source files and evaluate each ceremony budget.
 *
 * Reads all `.ts` files under the actions directory and counts pattern
 * matches against pre-defined budgets. Returns per-budget results and
 * an aggregate pass/fail.
 */
export async function runCheckActionCeremony(
  options: CheckActionCeremonyOptions
): Promise<Result<CheckActionCeremonyResult, CheckActionCeremonyError>> {
  try {
    const cwd = resolve(options.cwd);
    const actionsDir = resolve(cwd, ACTIONS_RELATIVE_DIR);
    const actionFiles = readActionSources(actionsDir);

    const counts = Object.fromEntries(
      CEREMONY_BUDGETS.map((budget) => [budget.id, 0] as const)
    ) as Record<CeremonyBudgetId, number>;

    for (const filePath of actionFiles) {
      const file = Bun.file(filePath);
      const content = await file.text();

      for (const budget of CEREMONY_BUDGETS) {
        if (
          budget.id === "direct-internalerror-construction" &&
          filePath.endsWith("shared.ts")
        ) {
          continue;
        }

        counts[budget.id] =
          (counts[budget.id] ?? 0) + countMatches(content, budget.pattern);
      }
    }

    const budgets = CEREMONY_BUDGETS.map((budget) => {
      const count = counts[budget.id] ?? 0;
      return {
        id: budget.id,
        description: budget.description,
        count,
        maxCount: budget.maxCount,
        ok: count <= budget.maxCount,
      } satisfies CeremonyBudgetResult;
    });

    return Result.ok({
      actionsDir,
      budgets,
      ok: budgets.every((budget) => budget.ok),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check action ceremony";
    return Result.err(new CheckActionCeremonyError(message));
  }
}

/**
 * Render ceremony check results to stdout/stderr.
 *
 * Emits JSON/JSONL for structured modes or a human-readable summary
 * listing any budgets that exceeded their limit.
 */
export async function printCheckActionCeremonyResult(
  result: CheckActionCeremonyResult,
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

  process.stdout.write(
    `[action-ceremony] checked ${result.budgets.length} guardrails in ${result.actionsDir}\n`
  );

  const failed = result.budgets.filter((budget) => !budget.ok);
  if (failed.length === 0) {
    process.stdout.write(
      "[action-ceremony] all ceremony guardrails are within budget\n"
    );
    return;
  }

  process.stderr.write("[action-ceremony] ceremony budget exceeded:\n");
  for (const budget of failed) {
    process.stderr.write(
      `  - ${budget.id}: ${budget.count}/${budget.maxCount} (${budget.description})\n`
    );
  }
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
        throw new CheckActionCeremonyError("Missing value for --cwd");
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

/**
 * CLI entry point: parse argv, run the ceremony check, and print results.
 *
 * @returns Exit code (0 on success, 1 on failure or error).
 */
export async function runCheckActionCeremonyFromArgv(
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

  const result = await runCheckActionCeremony({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckActionCeremonyResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckActionCeremonyFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
