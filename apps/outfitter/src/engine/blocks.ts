import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import { runAdd } from "../commands/add.js";
import type { EngineOptions } from "./types.js";
import { ScaffoldError } from "./types.js";

export async function addBlocks(
  targetDir: string,
  blocks: readonly string[],
  options: EngineOptions
): Promise<Result<AddBlockResult, ScaffoldError>> {
  const mergedResult: AddBlockResult = {
    created: [],
    skipped: [],
    overwritten: [],
    dependencies: {},
    devDependencies: {},
  };

  for (const blockName of blocks) {
    const result = await runAdd({
      block: blockName,
      force: options.force,
      dryRun: Boolean(options.collector),
      cwd: targetDir,
    });

    if (result.isErr()) {
      return Result.err(
        new ScaffoldError(
          `Failed to add block '${blockName}': ${result.error.message}`
        )
      );
    }

    if (options.collector) {
      options.collector.add({
        type: "block-add",
        name: blockName,
        files: [...result.value.created, ...result.value.overwritten],
      });
      for (const [name, version] of Object.entries(result.value.dependencies)) {
        options.collector.add({
          type: "dependency-add",
          name,
          version,
          section: "dependencies",
        });
      }
      for (const [name, version] of Object.entries(
        result.value.devDependencies
      )) {
        options.collector.add({
          type: "dependency-add",
          name,
          version,
          section: "devDependencies",
        });
      }
    }

    mergedResult.created.push(...result.value.created);
    mergedResult.skipped.push(...result.value.skipped);
    mergedResult.overwritten.push(...result.value.overwritten);
    Object.assign(mergedResult.dependencies, result.value.dependencies);
    Object.assign(mergedResult.devDependencies, result.value.devDependencies);
  }

  return Result.ok(mergedResult);
}
