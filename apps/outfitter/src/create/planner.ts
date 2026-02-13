import { Result, ValidationError } from "@outfitter/contracts";
import { deriveBinName, deriveProjectName } from "../engine/index.js";
import { getCreatePreset } from "./presets.js";
import type {
  CreatePlanChange,
  CreateProjectInput,
  CreateProjectPlan,
} from "./types.js";

function derivePackageName(input: CreateProjectInput): string {
  return (input.packageName ?? input.name).trim();
}

export function planCreateProject(
  input: CreateProjectInput
): Result<CreateProjectPlan, ValidationError> {
  const packageName = derivePackageName(input);
  if (packageName.length === 0) {
    return Result.err(
      new ValidationError({
        message: "Project name must not be empty",
        field: "name",
      })
    );
  }

  const targetDir = input.targetDir.trim();
  if (targetDir.length === 0) {
    return Result.err(
      new ValidationError({
        message: "Target directory must not be empty",
        field: "targetDir",
      })
    );
  }

  if (packageName.startsWith("@") && !packageName.includes("/")) {
    return Result.err(
      new ValidationError({
        message: "Could not derive a project name from package name",
        field: "packageName",
      })
    );
  }

  const projectName = deriveProjectName(packageName);
  if (projectName.length === 0) {
    return Result.err(
      new ValidationError({
        message: "Could not derive a project name from package name",
        field: "packageName",
      })
    );
  }

  const preset = getCreatePreset(input.preset);
  if (!preset) {
    return Result.err(
      new ValidationError({
        message: `Unknown create preset '${input.preset}'`,
        field: "preset",
      })
    );
  }
  const includeTooling = input.includeTooling ?? true;
  const defaultBlocks = includeTooling ? [...preset.defaultBlocks] : [];
  const changes: CreatePlanChange[] = [
    {
      type: "copy-template",
      template: preset.template,
      targetDir,
      overlayBaseTemplate: true,
    },
    { type: "inject-shared-config" },
  ];

  if (input.local) {
    changes.push({ type: "rewrite-local-dependencies", mode: "workspace" });
  }

  if (defaultBlocks.length > 0) {
    changes.push({ type: "add-blocks", blocks: defaultBlocks });
  }

  const plan: CreateProjectPlan = {
    preset,
    values: {
      packageName,
      projectName,
      version: input.version?.trim() || "0.1.0",
      description:
        input.description?.trim() || "A new project created with Outfitter",
      binName: deriveBinName(projectName),
      year: input.year ?? String(new Date().getFullYear()),
    },
    changes,
  };

  return Result.ok(plan);
}
