// biome-ignore lint/performance/noBarrelFile: intentional re-export for targets module API surface.
export {
  getInitTarget,
  getReadyTarget,
  getScaffoldTarget,
  getTarget,
  INIT_TARGET_IDS,
  listTargets,
  READY_TARGET_IDS,
  resolvePlacement,
  SCAFFOLD_TARGET_IDS,
  TARGET_IDS,
  TARGET_REGISTRY,
} from "./registry.js";
export type {
  TargetCategory,
  TargetDefinition,
  TargetId,
  TargetScope,
  TargetStatus,
} from "./types.js";
