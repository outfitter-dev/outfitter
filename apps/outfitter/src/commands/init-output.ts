import { realpath } from "node:fs/promises";

import { output } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";

import { OperationCollector } from "../engine/collector.js";
import { renderOperationPlan } from "../engine/render-plan.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import type { InitResult } from "./init.js";

export interface PrintInitResultsOptions {
  readonly mode?: OutputMode;
}

export async function printInitResults(
  result: InitResult,
  options?: PrintInitResultsOptions
): Promise<void> {
  // Normalize paths for display (resolves symlinks like /tmp -> /private/tmp on macOS)
  let rootDir = result.rootDir;
  let projectDir = result.projectDir;
  try {
    rootDir = await realpath(rootDir);
    projectDir = await realpath(projectDir);
  } catch {
    // Fall back to raw paths if realpath fails (e.g., path doesn't exist yet in dry-run)
  }

  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (result.dryRunPlan) {
    if (structuredMode) {
      await output(
        {
          rootDir,
          projectDir,
          structure: result.structure,
          preset: result.preset,
          packageName: result.packageName,
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
    await renderOperationPlan(collector, { rootDir });
    return;
  }

  if (structuredMode) {
    await output(
      {
        structure: result.structure,
        rootDir,
        projectDir,
        preset: result.preset,
        packageName: result.packageName,
        blocksAdded: result.blocksAdded ?? null,
        postScaffold: result.postScaffold,
        nextSteps: result.postScaffold.nextSteps,
      },
      { mode: structuredMode }
    );
    return;
  }

  const lines: string[] = [
    `Project initialized successfully in ${rootDir}`,
    `Structure: ${result.structure}`,
    `Preset: ${result.preset}`,
  ];

  if (result.structure === "workspace") {
    lines.push(`Workspace project path: ${projectDir}`);
  }

  if (result.blocksAdded) {
    const { created, skipped, dependencies, devDependencies } =
      result.blocksAdded;

    if (created.length > 0) {
      lines.push("", `Added ${created.length} tooling file(s):`);
      for (const file of created) {
        lines.push(`  \u2713 ${file}`);
      }
    }

    if (skipped.length > 0) {
      lines.push("", `Skipped ${skipped.length} existing file(s):`);
      for (const file of skipped) {
        lines.push(`  - ${file}`);
      }
    }

    const depCount =
      Object.keys(dependencies).length + Object.keys(devDependencies).length;
    if (depCount > 0) {
      lines.push("", `Added ${depCount} package(s) to package.json:`);
      for (const [name, version] of Object.entries(dependencies)) {
        lines.push(`  + ${name}@${version}`);
      }
      for (const [name, version] of Object.entries(devDependencies)) {
        lines.push(`  + ${name}@${version} (dev)`);
      }
    }
  }

  if (result.postScaffold.installResult === "failed") {
    lines.push(
      "",
      `Warning: bun install failed: ${result.postScaffold.installError ?? "unknown"}`
    );
  }
  if (result.postScaffold.gitInitResult === "failed") {
    lines.push(
      "",
      `Warning: git setup failed: ${result.postScaffold.gitError ?? "unknown"}`
    );
  }

  lines.push("", "Next steps:");
  for (const step of result.postScaffold.nextSteps) {
    lines.push(`  ${step}`);
  }

  await output(lines, { mode: "human" });
}
