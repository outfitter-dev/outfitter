import { output } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";

import { OperationCollector } from "../engine/collector.js";
import { renderOperationPlan } from "../engine/render-plan.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import type { ScaffoldCommandResult } from "./scaffold.js";

/** Options controlling how scaffold results are rendered (human-readable, JSON, or JSONL). */
export interface PrintScaffoldResultsOptions {
  readonly mode?: OutputMode;
}

/**
 * Renders scaffold results to stdout. Handles dry-run plans, structured output modes,
 * and human-readable summaries including workspace conversion details and next steps.
 */
export async function printScaffoldResults(
  result: ScaffoldCommandResult,
  options?: PrintScaffoldResultsOptions
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (result.dryRunPlan) {
    if (structuredMode) {
      await output(
        {
          target: result.target,
          rootDir: result.rootDir,
          targetDir: result.targetDir,
          converted: result.converted,
          movedExisting: result.movedExisting ?? null,
          ...result.dryRunPlan,
        },
        { mode: structuredMode }
      );
      return;
    }

    const collector = new OperationCollector();
    for (const op of result.dryRunPlan.operations) {
      collector.add(op as never);
    }
    await renderOperationPlan(collector, { rootDir: result.rootDir });
    return;
  }

  if (structuredMode) {
    await output(
      {
        target: result.target,
        rootDir: result.rootDir,
        targetDir: result.targetDir,
        converted: result.converted,
        movedExisting: result.movedExisting ?? null,
        workspacePatternsUpdated: result.workspacePatternsUpdated,
        blocksAdded: result.blocksAdded ?? null,
        postScaffold: result.postScaffold,
        nextSteps: result.postScaffold.nextSteps,
      },
      { mode: structuredMode }
    );
    return;
  }

  const lines: string[] = [];
  if (result.converted) {
    lines.push("Converted to workspace structure:");
    if (result.movedExisting) {
      lines.push(`  Moved existing package -> ${result.movedExisting.to}`);
    }
    lines.push("  Created workspace root package.json");
    lines.push("");
  }

  lines.push(`Scaffolded ${result.targetDir}`);
  if (result.blocksAdded && result.blocksAdded.created.length > 0) {
    lines.push(`Added ${result.blocksAdded.created.length} tooling file(s):`);
    for (const created of result.blocksAdded.created) {
      lines.push(`  + ${created}`);
    }
  }

  lines.push("", "Next steps:");
  for (const step of result.postScaffold.nextSteps) {
    lines.push(`  ${step}`);
  }

  await output(lines, { mode: "human" });
}
