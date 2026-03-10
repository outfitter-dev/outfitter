#!/usr/bin/env bun

/**
 * Manual scaffold E2E runner with managed temp-directory cleanup.
 *
 * @packageDocumentation
 */

import {
  resolveScaffoldE2EPresets,
  runScaffoldE2ESuite,
} from "../scaffold-e2e/runner.js";
import {
  DEFAULT_SCAFFOLD_E2E_RETENTION_MS,
  cleanupScaffoldE2ERunDir,
  createScaffoldE2ERunDir,
  pruneScaffoldE2ERuns,
  resolveScaffoldE2ERoot,
} from "../scaffold-e2e/workspace.js";

interface ParsedArgs {
  readonly clean: boolean;
  readonly keep: boolean;
  readonly maxAgeMs: number;
  readonly presets: readonly string[] | undefined;
  readonly rootDir: string | undefined;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let clean = false;
  let keep = process.env["OUTFITTER_SCAFFOLD_E2E_KEEP"] === "1";
  let rootDir = process.env["OUTFITTER_SCAFFOLD_E2E_ROOT"];
  let maxAgeMs = DEFAULT_SCAFFOLD_E2E_RETENTION_MS;
  const presets: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--clean") {
      clean = true;
      continue;
    }

    if (arg === "--keep") {
      keep = true;
      continue;
    }

    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --root");
      }
      rootDir = value;
      index += 1;
      continue;
    }

    if (arg === "--max-age-hours") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --max-age-hours");
      }

      const hours = Number(value);
      if (!Number.isFinite(hours) || hours < 0) {
        throw new Error(`Invalid --max-age-hours value: ${value}`);
      }

      maxAgeMs = hours * 60 * 60 * 1000;
      index += 1;
      continue;
    }

    if (arg === "--preset") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --preset");
      }
      presets.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    clean,
    keep,
    maxAgeMs,
    presets: presets.length > 0 ? presets : undefined,
    rootDir,
  };
}

function printPruneSummary(
  action: "pruned" | "cleaned",
  removedCount: number,
  rootDir: string
): void {
  process.stdout.write(
    `[scaffold-e2e] ${action} ${removedCount} run(s) under ${rootDir}\n`
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolveScaffoldE2ERoot(args.rootDir);

  if (args.clean) {
    const cleanResult = pruneScaffoldE2ERuns({
      rootDir,
      removeAll: true,
    });
    printPruneSummary(
      "cleaned",
      cleanResult.removed.length,
      cleanResult.rootDir
    );
    return;
  }

  const pruneResult = pruneScaffoldE2ERuns({
    rootDir,
    maxAgeMs: args.maxAgeMs,
  });
  if (pruneResult.removed.length > 0) {
    printPruneSummary(
      "pruned",
      pruneResult.removed.length,
      pruneResult.rootDir
    );
  }

  const runDir = createScaffoldE2ERunDir({
    rootDir,
    runLabel: "manual",
  });
  const presets = resolveScaffoldE2EPresets(args.presets);
  let completed = false;

  process.stdout.write(`[scaffold-e2e] run dir: ${runDir}\n`);
  process.stdout.write(`[scaffold-e2e] presets: ${presets.join(", ")}\n`);

  try {
    const results = await runScaffoldE2ESuite({
      runDir,
      presets,
    });

    completed = true;
    for (const result of results) {
      process.stdout.write(
        `[scaffold-e2e] ${result.preset} ok (${result.steps
          .map((step) => `${step.command} in ${step.durationMs}ms`)
          .join(", ")})\n`
      );
    }
  } finally {
    if (completed && !args.keep) {
      cleanupScaffoldE2ERunDir(runDir);
      process.stdout.write(`[scaffold-e2e] removed ${runDir}\n`);
    } else {
      process.stdout.write(`[scaffold-e2e] preserved ${runDir}\n`);
    }
  }
}

await main();
