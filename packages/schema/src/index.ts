/**
 * @outfitter/schema — Schema introspection and surface map generation.
 *
 * Generates machine-readable manifests from ActionRegistries,
 * enabling agents and CI to discover capabilities and detect drift.
 *
 * @packageDocumentation
 */

export {
  type DiffEntry,
  diffSurfaceMaps,
  type ModifiedEntry,
  type SurfaceMapDiff,
} from "./diff.js";
export {
  type ActionManifest,
  type ActionManifestEntry,
  type ActionSource,
  type GenerateManifestOptions,
  generateManifest,
  type ManifestApiSpec,
  type ManifestCliOption,
  type ManifestCliSpec,
  type ManifestMcpSpec,
} from "./manifest.js";

export {
  type GenerateSurfaceMapOptions,
  generateSurfaceMap,
  readSurfaceMap,
  resolveSnapshotPath,
  type SurfaceMap,
  writeSurfaceMap,
} from "./surface.js";
