#!/usr/bin/env bun

/**
 * Manual scaffold E2E runner with managed temp-directory cleanup.
 *
 * @packageDocumentation
 */

import { parseScaffoldE2EArgs } from "../scaffold-e2e/cli.js";
import { resolveScaffoldE2EProfile } from "../scaffold-e2e/config.js";
import {
  resolveScaffoldE2EPresets,
  runScaffoldE2ESuite,
} from "../scaffold-e2e/runner.js";
import {
  cleanupScaffoldE2ERunDir,
  createScaffoldE2ERunDir,
  pruneScaffoldE2ERuns,
  resolveScaffoldE2ERoot,
} from "../scaffold-e2e/workspace.js";

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
  const args = parseScaffoldE2EArgs(process.argv.slice(2));
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

  const profile = resolveScaffoldE2EProfile(args.profile);
  const presets = resolveScaffoldE2EPresets(args.presets);
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

  const runDir = createScaffoldE2ERunDir({ rootDir, runLabel: "manual" });
  let completed = false;

  process.stdout.write(`[scaffold-e2e] run dir: ${runDir}\n`);
  process.stdout.write(`[scaffold-e2e] profile: ${profile.id}\n`);
  process.stdout.write(`[scaffold-e2e] presets: ${presets.join(", ")}\n`);

  try {
    const results = await runScaffoldE2ESuite({
      profile: args.profile,
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

await main().catch((error: unknown) => {
  process.stderr.write(
    `[scaffold-e2e] error: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
