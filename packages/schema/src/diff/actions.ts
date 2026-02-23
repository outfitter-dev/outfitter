import type { ActionManifestEntry } from "../manifest.js";
import type { SurfaceMap } from "../surface.js";
import { sortedStringArrayEquals, stableJson } from "./shared.js";
import type { ActionDiffResult, EntryComparator } from "./types.js";

export function compareEntries(
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

  if (!sortedStringArrayEquals(committed.surfaces, current.surfaces)) {
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

export function diffActions(
  committed: SurfaceMap,
  current: SurfaceMap,
  entryComparator: EntryComparator = compareEntries
): ActionDiffResult {
  const committedMap = new Map(committed.actions.map((a) => [a.id, a]));
  const currentMap = new Map(current.actions.map((a) => [a.id, a]));

  const added: ActionDiffResult["added"] = [];
  const removed: ActionDiffResult["removed"] = [];
  const modified: ActionDiffResult["modified"] = [];

  for (const [id] of currentMap) {
    if (!committedMap.has(id)) {
      added.push({ id });
    }
  }

  for (const [id] of committedMap) {
    if (!currentMap.has(id)) {
      removed.push({ id });
    }
  }

  for (const [id, committedEntry] of committedMap) {
    const currentEntry = currentMap.get(id);
    if (!currentEntry) {
      continue;
    }

    const changes = entryComparator(committedEntry, currentEntry);
    if (changes.length > 0) {
      modified.push({ id, changes });
    }
  }

  return { added, removed, modified };
}
