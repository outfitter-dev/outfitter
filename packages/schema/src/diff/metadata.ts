import type { SurfaceMap } from "../surface.js";
import { hasOwnKey, sortedStringArrayEquals, stableJson } from "./shared.js";
import type { DiffSurfaceMapsOptions, SurfaceMapDiffMode } from "./types.js";

function isExpectedRuntimePair(
  committed: SurfaceMap,
  current: SurfaceMap
): boolean {
  return committed.generator === "build" && current.generator === "runtime";
}

function generatorHasUnexpectedValue(
  committed: SurfaceMap,
  current: SurfaceMap,
  mode: SurfaceMapDiffMode
): boolean {
  if (mode === "committed-to-runtime" || mode === "snapshot-to-runtime") {
    return !isExpectedRuntimePair(committed, current);
  }

  if (mode === "snapshot-to-snapshot") {
    return committed.generator !== current.generator;
  }

  // "auto" keeps backwards compatibility for existing consumers:
  // equal generators or build/runtime pair are both valid.
  return (
    committed.generator !== current.generator &&
    !isExpectedRuntimePair(committed, current)
  );
}

export function diffMetadata(
  committed: SurfaceMap,
  current: SurfaceMap,
  options?: DiffSurfaceMapsOptions
): string[] {
  const metadataChanges: string[] = [];

  if (committed.version !== current.version) {
    metadataChanges.push("version");
  }

  if (!sortedStringArrayEquals(committed.surfaces, current.surfaces)) {
    metadataChanges.push("surfaces");
  }

  if (stableJson(committed.errors) !== stableJson(current.errors)) {
    metadataChanges.push("errors");
  }

  if (stableJson(committed.outputModes) !== stableJson(current.outputModes)) {
    metadataChanges.push("outputModes");
  }

  const hasCommittedSchema = hasOwnKey(committed, "$schema");
  const hasCurrentSchema = hasOwnKey(current, "$schema");
  if (hasCommittedSchema !== hasCurrentSchema) {
    metadataChanges.push("$schema");
  } else if (hasCommittedSchema && committed.$schema !== current.$schema) {
    metadataChanges.push("$schema");
  }

  const hasCommittedGenerator = hasOwnKey(committed, "generator");
  const hasCurrentGenerator = hasOwnKey(current, "generator");
  if (!(hasCommittedGenerator && hasCurrentGenerator)) {
    metadataChanges.push("generator");
  } else if (
    generatorHasUnexpectedValue(committed, current, options?.mode ?? "auto")
  ) {
    metadataChanges.push("generator");
  }

  return metadataChanges;
}
