/**
 * Create planner types for kit-first project scaffolding.
 *
 * These types model preset intent separately from execution so future flows can
 * consume a deterministic plan before mutating the filesystem.
 */

export type CreatePresetId = "basic" | "cli" | "daemon" | "mcp";

export interface CreatePresetDefinition {
  readonly id: CreatePresetId;
  readonly template: CreatePresetId;
  readonly summary: string;
  readonly defaultBlocks: readonly string[];
}

export interface CreateProjectInput {
  readonly name: string;
  readonly targetDir: string;
  readonly preset: CreatePresetId;
  readonly packageName?: string;
  readonly description?: string;
  readonly version?: string;
  readonly includeTooling?: boolean;
  readonly local?: boolean;
  readonly year?: string;
}

export type CreatePlanChange =
  | {
      readonly type: "copy-template";
      readonly template: string;
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
  readonly preset: CreatePresetDefinition;
  readonly values: {
    readonly packageName: string;
    readonly projectName: string;
    readonly version: string;
    readonly description: string;
    readonly binName: string;
    readonly year: string;
  };
  readonly changes: readonly CreatePlanChange[];
}
