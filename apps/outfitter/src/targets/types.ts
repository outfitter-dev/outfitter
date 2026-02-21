/**
 * Unique identifier for a scaffold target.
 */
export type TargetId =
  | "minimal"
  | "cli"
  | "mcp"
  | "daemon"
  | "library"
  | "full-stack"
  | "api"
  | "worker"
  | "web";

/**
 * Whether the target produces a runnable application or a library package.
 */
export type TargetCategory = "runnable" | "library";

/**
 * Whether the target has a working template or is a planned placeholder.
 */
export type TargetStatus = "ready" | "stub";

/**
 * Whether a target can be used with init, scaffold, or both.
 */
export type TargetScope = "init-only" | "scaffold-only" | "both";

/**
 * Complete definition for a scaffold target.
 */
export interface TargetDefinition {
  readonly category: TargetCategory;
  readonly defaultBlocks: readonly string[];
  readonly description: string;
  readonly id: TargetId;
  readonly placement: "apps" | "packages";
  readonly presetDir: string;
  readonly scope: TargetScope;
  readonly status: TargetStatus;
}
