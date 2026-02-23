import type { ActionManifestEntry } from "../manifest.js";

export interface SurfaceMapDiff {
  readonly added: readonly DiffEntry[];
  readonly hasChanges: boolean;
  readonly metadataChanges: readonly string[];
  readonly modified: readonly ModifiedEntry[];
  readonly removed: readonly DiffEntry[];
}

export interface DiffEntry {
  readonly id: string;
}

export interface ModifiedEntry extends DiffEntry {
  readonly changes: readonly string[];
}

export type SurfaceMapDiffMode =
  | "auto"
  | "committed-to-runtime"
  | "snapshot-to-runtime"
  | "snapshot-to-snapshot";

export interface DiffSurfaceMapsOptions {
  readonly mode?: SurfaceMapDiffMode;
}

export interface ActionDiffResult {
  readonly added: DiffEntry[];
  readonly modified: ModifiedEntry[];
  readonly removed: DiffEntry[];
}

export type EntryComparator = (
  committed: ActionManifestEntry,
  current: ActionManifestEntry
) => string[];
