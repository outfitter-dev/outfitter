/**
 * Create planner types for kit-first project scaffolding.
 *
 * These types model preset intent separately from execution so future flows can
 * consume a deterministic plan before mutating the filesystem.
 */

export type CreatePresetId = "basic" | "cli" | "daemon" | "mcp";

export interface CreatePresetDefinition {
  readonly defaultBlocks: readonly string[];
  readonly id: CreatePresetId;
  readonly presetDir: CreatePresetId;
  readonly summary: string;
}

export interface CreateProjectInput {
  readonly description?: string;
  readonly includeTooling?: boolean;
  readonly local?: boolean;
  readonly name: string;
  readonly packageName?: string;
  readonly preset: CreatePresetId;
  readonly targetDir: string;
  readonly version?: string;
  readonly year?: string;
}

export type CreatePlanChange =
  | {
      readonly type: "copy-preset";
      readonly preset: string;
      readonly targetDir: string;
      readonly overlayBaseTemplate: boolean;
    }
  | {
      readonly type: "inject-shared-config";
    }
  | {
      readonly type: "rewrite-local-dependencies";
      readonly mode: "workspace";
    }
  | {
      readonly type: "add-blocks";
      readonly blocks: readonly string[];
    };

export interface CreateProjectPlan {
  readonly changes: readonly CreatePlanChange[];
  readonly preset: CreatePresetDefinition;
  readonly values: {
    readonly packageName: string;
    readonly projectName: string;
    readonly version: string;
    readonly description: string;
    readonly binName: string;
    readonly year: string;
  };
}
