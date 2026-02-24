import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { Result } from "@outfitter/contracts";

import { addBlocks } from "./blocks.js";
import { injectSharedConfig, rewriteLocalDependencies } from "./config.js";
import { copyPresetFiles, getPresetsBaseDir } from "./preset.js";
import type { EngineOptions, ScaffoldPlan, ScaffoldResult } from "./types.js";
import { ScaffoldError } from "./types.js";

const TOOLING_PRESET_PATHS = new Set([
  ".claude/settings.json",
  ".claude/hooks/format-code-on-stop.sh",
  ".lefthook.yml",
  ".markdownlint-cli2.jsonc",
  ".oxlintrc.json",
  ".oxfmtrc.jsonc",
  // Keep legacy Biome config support for older preset snapshots.
  "biome.json",
  "scripts/bootstrap.sh",
]);

function createPresetSkipFilter(
  includeTooling: boolean
): ((relativePath: string) => boolean) | undefined {
  if (includeTooling) {
    return undefined;
  }
  return (relativePath) => {
    const normalized = relativePath.endsWith(".template")
      ? relativePath.slice(0, -".template".length)
      : relativePath;
    return TOOLING_PRESET_PATHS.has(normalized);
  };
}

export async function executePlan(
  plan: ScaffoldPlan,
  options: EngineOptions
): Promise<Result<ScaffoldResult, ScaffoldError>> {
  try {
    const presetsDir = getPresetsBaseDir();
    let projectDir: string | undefined;
    let blocksAdded: ScaffoldResult["blocksAdded"];

    for (const change of plan.changes) {
      switch (change.type) {
        case "copy-preset": {
          projectDir = change.targetDir;
          if (!(existsSync(projectDir) || options.collector)) {
            mkdirSync(projectDir, { recursive: true });
          }

          const presetPath = join(presetsDir, change.preset);
          if (!existsSync(presetPath)) {
            return Result.err(
              new ScaffoldError(
                `Preset '${change.preset}' not found in ${presetsDir}`
              )
            );
          }
          const skipFilter = createPresetSkipFilter(change.includeTooling);

          if (change.overlayBaseTemplate) {
            const basePath = join(presetsDir, "_base");
            if (existsSync(basePath)) {
              const baseWrittenPaths = new Set<string>();
              const baseResult = copyPresetFiles(
                basePath,
                projectDir,
                plan.values,
                options,
                {
                  writtenPaths: baseWrittenPaths,
                  ...(skipFilter ? { skipFilter } : {}),
                }
              );
              if (baseResult.isErr()) {
                return baseResult;
              }

              const presetResult = copyPresetFiles(
                presetPath,
                projectDir,
                plan.values,
                options,
                {
                  allowOverwrite: true,
                  overwritablePaths: baseWrittenPaths,
                  ...(skipFilter ? { skipFilter } : {}),
                }
              );
              if (presetResult.isErr()) {
                return presetResult;
              }
              break;
            }
          }

          const presetResult = copyPresetFiles(
            presetPath,
            projectDir,
            plan.values,
            options,
            {
              ...(skipFilter ? { skipFilter } : {}),
            }
          );
          if (presetResult.isErr()) {
            return presetResult;
          }
          break;
        }

        case "inject-shared-config": {
          if (!projectDir) {
            break;
          }
          if (options.collector) {
            options.collector.add({
              type: "config-inject",
              target: join(projectDir, "package.json"),
              description: "Inject shared scripts/devDependencies",
            });
          } else {
            const result = injectSharedConfig(projectDir);
            if (result.isErr()) {
              return result;
            }
          }
          break;
        }

        case "rewrite-local-dependencies": {
          if (!projectDir) {
            break;
          }
          if (options.collector) {
            options.collector.add({
              type: "config-inject",
              target: join(projectDir, "package.json"),
              description:
                "Rewrite local @outfitter/* dependencies to workspace:*",
            });
          } else {
            const result = rewriteLocalDependencies(projectDir);
            if (result.isErr()) {
              return result;
            }
          }
          break;
        }

        case "add-blocks": {
          if (!projectDir) {
            break;
          }
          const result = await addBlocks(projectDir, change.blocks, options);
          if (result.isErr()) {
            return result;
          }
          blocksAdded = result.value;
          break;
        }
        default: {
          break;
        }
      }
    }

    if (!projectDir) {
      return Result.err(new ScaffoldError("Plan contains no copy-preset step"));
    }

    return Result.ok({ projectDir, blocksAdded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to execute scaffold plan: ${message}`)
    );
  }
}
