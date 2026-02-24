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
  type DiffSurfaceMapsOptions,
  diffSurfaceMaps,
  type ModifiedEntry,
  type SurfaceMapDiff,
  type SurfaceMapDiffMode,
} from "./diff/index.js";
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
  formatManifestMarkdown,
  type MarkdownFormatOptions,
} from "./markdown.js";

export {
  type GenerateSurfaceMapOptions,
  generateSurfaceMap,
  readSurfaceMap,
  resolveSnapshotPath,
  type SurfaceMap,
  writeSurfaceMap,
} from "./surface.js";
