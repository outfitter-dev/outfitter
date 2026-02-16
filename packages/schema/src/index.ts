/**
 * @outfitter/schema — Schema introspection and surface map generation.
 *
 * Generates machine-readable manifests from ActionRegistries,
 * enabling agents and CI to discover capabilities and detect drift.
 *
 * @packageDocumentation
 */

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
