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

export interface CheckActionCeremonyOptions {
  readonly cwd: string;
}

export interface CeremonyBudgetResult {
  readonly count: number;
  readonly description: string;
  readonly id: string;
  readonly maxCount: number;
  readonly ok: boolean;
}

export interface CheckActionCeremonyResult {
  readonly actionsDir: string;
  readonly budgets: readonly CeremonyBudgetResult[];
  readonly ok: boolean;
}

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

export async function runCheckActionCeremony(
  options: CheckActionCeremonyOptions
): Promise<Result<CheckActionCeremonyResult, CheckActionCeremonyError>> {
  try {
    const cwd = resolve(options.cwd);
    const actionsDir = resolve(cwd, ACTIONS_RELATIVE_DIR);
    const actionFiles = readActionSources(actionsDir);

    const counts: Record<string, number> = {
      "direct-defineAction-generics": 0,
      "schema-zodtype-casts": 0,
      "direct-internalerror-construction": 0,
    };

    for (const filePath of actionFiles) {
      const file = Bun.file(filePath);
      const content = await file.text();

      counts["direct-defineAction-generics"] =
        (counts["direct-defineAction-generics"] ?? 0) +
        countMatches(content, CEREMONY_BUDGETS[0]!.pattern);
      counts["schema-zodtype-casts"] =
        (counts["schema-zodtype-casts"] ?? 0) +
        countMatches(content, CEREMONY_BUDGETS[1]!.pattern);

      if (!filePath.endsWith("shared.ts")) {
        counts["direct-internalerror-construction"] =
          (counts["direct-internalerror-construction"] ?? 0) +
          countMatches(content, CEREMONY_BUDGETS[2]!.pattern);
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
