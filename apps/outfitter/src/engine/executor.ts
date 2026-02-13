import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@outfitter/contracts";
import { addBlocks } from "./blocks.js";
import { injectSharedConfig, rewriteLocalDependencies } from "./config.js";
import { copyTemplateFiles, getTemplatesDir } from "./template.js";
import type { EngineOptions, ScaffoldPlan, ScaffoldResult } from "./types.js";
import { ScaffoldError } from "./types.js";

export async function executePlan(
  plan: ScaffoldPlan,
  options: EngineOptions
): Promise<Result<ScaffoldResult, ScaffoldError>> {
  try {
    const templatesDir = getTemplatesDir();
    let projectDir: string | undefined;
    let blocksAdded: ScaffoldResult["blocksAdded"];

    for (const change of plan.changes) {
      switch (change.type) {
        case "copy-template": {
          projectDir = change.targetDir;
          if (!(existsSync(projectDir) || options.collector)) {
            mkdirSync(projectDir, { recursive: true });
          }

          const templatePath = join(templatesDir, change.template);
          if (!existsSync(templatePath)) {
            return Result.err(
              new ScaffoldError(
                `Template '${change.template}' not found in ${templatesDir}`
              )
            );
          }

          if (change.overlayBaseTemplate) {
            const basePath = join(templatesDir, "_base");
            if (existsSync(basePath)) {
              const baseWrittenPaths = new Set<string>();
              const baseResult = copyTemplateFiles(
                basePath,
                projectDir,
                plan.values,
                options,
                {
                  writtenPaths: baseWrittenPaths,
                }
              );
              if (baseResult.isErr()) {
                return baseResult;
              }

              const templateResult = copyTemplateFiles(
                templatePath,
                projectDir,
                plan.values,
                options,
                {
                  allowOverwrite: true,
                  overwritablePaths: baseWrittenPaths,
                }
              );
              if (templateResult.isErr()) {
                return templateResult;
              }
              break;
            }
          }

          const templateResult = copyTemplateFiles(
            templatePath,
            projectDir,
            plan.values,
            options
          );
          if (templateResult.isErr()) {
            return templateResult;
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
      return Result.err(
        new ScaffoldError("Plan contains no copy-template step")
      );
    }

    return Result.ok({ projectDir, blocksAdded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to execute scaffold plan: ${message}`)
    );
  }
}
