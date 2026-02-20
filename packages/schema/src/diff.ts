/**
 * Surface map structural diff.
 *
 * Compares two surface maps and reports added, removed, and modified actions.
 * Strips volatile fields (generatedAt) before comparison.
 *
 * @packageDocumentation
 */

import type { ActionManifestEntry } from "./manifest.js";
import type { SurfaceMap } from "./surface.js";

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Diff Logic
// =============================================================================

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

function compareEntries(
  committed: ActionManifestEntry,
  current: ActionManifestEntry
): string[] {
  const changes: string[] = [];

  if (stableJson(committed.input) !== stableJson(current.input)) {
    changes.push("input");
  }

  if (stableJson(committed.output) !== stableJson(current.output)) {
    changes.push("output");
  }

  if (
    JSON.stringify([...committed.surfaces].sort()) !==
    JSON.stringify([...current.surfaces].sort())
  ) {
    changes.push("surfaces");
  }

  if (committed.description !== current.description) {
    changes.push("description");
  }

  if (stableJson(committed.cli) !== stableJson(current.cli)) {
    changes.push("cli");
  }

  if (stableJson(committed.mcp) !== stableJson(current.mcp)) {
    changes.push("mcp");
  }

  if (stableJson(committed.api) !== stableJson(current.api)) {
    changes.push("api");
  }

  return changes;
}

/**
 * Compare two surface maps and return a structured diff.
 *
 * Ignores volatile fields like `generatedAt`. Reports added, removed,
 * and modified actions with specific change categories.
 *
 * @param committed - The previously committed surface map
 * @param current - The current runtime surface map
 * @returns Structured diff result
 */
export function diffSurfaceMaps(
  committed: SurfaceMap,
  current: SurfaceMap
): SurfaceMapDiff {
  // Compare top-level metadata (everything except volatile generatedAt and actions)
  const metadataChanges: string[] = [];

  if (committed.version !== current.version) {
    metadataChanges.push("version");
  }

  if (
    JSON.stringify([...committed.surfaces].sort()) !==
    JSON.stringify([...current.surfaces].sort())
  ) {
    metadataChanges.push("surfaces");
  }

  if (stableJson(committed.errors) !== stableJson(current.errors)) {
    metadataChanges.push("errors");
  }

  if (stableJson(committed.outputModes) !== stableJson(current.outputModes)) {
    metadataChanges.push("outputModes");
  }

  if (
    "$schema" in committed &&
    "$schema" in current &&
    committed.$schema !== current.$schema
  ) {
    metadataChanges.push("$schema");
  }

  // Compare actions
  const committedMap = new Map(committed.actions.map((a) => [a.id, a]));
  const currentMap = new Map(current.actions.map((a) => [a.id, a]));

  const added: DiffEntry[] = [];
  const removed: DiffEntry[] = [];
  const modified: ModifiedEntry[] = [];

  // Find added actions
  for (const [id] of currentMap) {
    if (!committedMap.has(id)) {
      added.push({ id });
    }
  }

  // Find removed actions
  for (const [id] of committedMap) {
    if (!currentMap.has(id)) {
      removed.push({ id });
    }
  }

  // Find modified actions
  for (const [id, committedEntry] of committedMap) {
    const currentEntry = currentMap.get(id);
    if (!currentEntry) {
      continue;
    }

    const changes = compareEntries(committedEntry, currentEntry);
    if (changes.length > 0) {
      modified.push({ id, changes });
    }
  }

  return {
    hasChanges:
      added.length > 0 ||
      removed.length > 0 ||
      modified.length > 0 ||
      metadataChanges.length > 0,
    added,
    removed,
    modified,
    metadataChanges,
  };
}
