import type { SurfaceMap } from "../surface.js";
import { diffActions } from "./actions.js";
import { diffMetadata } from "./metadata.js";
import type { DiffSurfaceMapsOptions, SurfaceMapDiff } from "./types.js";

/**
 * Compare two surface maps and return a structured diff.
 *
 * Ignores volatile fields like `generatedAt`. Reports added, removed,
 * and modified actions with specific change categories.
 *
 * @param committed - The previously committed surface map
 * @param current - The current runtime surface map
 * @param options - Optional comparison mode
 * @returns Structured diff result
 */
export function diffSurfaceMaps(
  committed: SurfaceMap,
  current: SurfaceMap,
  options?: DiffSurfaceMapsOptions
): SurfaceMapDiff {
  const metadataChanges = diffMetadata(committed, current, options);
  const actionDiff = diffActions(committed, current);

  return {
    hasChanges:
      actionDiff.added.length > 0 ||
      actionDiff.removed.length > 0 ||
      actionDiff.modified.length > 0 ||
      metadataChanges.length > 0,
    added: actionDiff.added,
    removed: actionDiff.removed,
    modified: actionDiff.modified,
    metadataChanges,
  };
}
