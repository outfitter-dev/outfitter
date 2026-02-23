/**
 * Surface map structural diff.
 *
 * Backward-compatible re-exports for the modularized diff implementation.
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: re-export entrypoint preserves public import path
export { diffSurfaceMaps } from "./diff/index.js";
export { stableJson } from "./diff/shared.js";
export type {
  DiffEntry,
  DiffSurfaceMapsOptions,
  ModifiedEntry,
  SurfaceMapDiff,
  SurfaceMapDiffMode,
} from "./diff/types.js";
