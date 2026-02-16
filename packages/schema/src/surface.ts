/**
 * Surface map generation and I/O.
 *
 * A surface map extends the action manifest with envelope metadata
 * for build-time generation, file persistence, and drift detection.
 *
 * @packageDocumentation
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  type ActionManifest,
  type ActionSource,
  type GenerateManifestOptions,
  generateManifest,
} from "./manifest.js";

// =============================================================================
// Types
// =============================================================================

export interface SurfaceMap extends ActionManifest {
  readonly $schema: string;
  readonly generator: "runtime" | "build";
}

export interface GenerateSurfaceMapOptions extends GenerateManifestOptions {
  readonly generator?: "runtime" | "build";
}

const SURFACE_MAP_SCHEMA = "https://outfitter.dev/surface/v1";

// =============================================================================
// Generation
// =============================================================================

/**
 * Generate a surface map from an action registry or action array.
 *
 * Wraps `generateManifest()` with envelope metadata (`$schema`, `generator`).
 *
 * @param source - ActionRegistry or array of ActionSpec
 * @param options - Filtering, version, and generator options
 * @returns The surface map object
 */
export function generateSurfaceMap(
  source: ActionSource,
  options?: GenerateSurfaceMapOptions
): SurfaceMap {
  const manifest = generateManifest(source, options);

  return {
    ...manifest,
    $schema: SURFACE_MAP_SCHEMA,
    generator: options?.generator ?? "runtime",
  };
}

// =============================================================================
// File I/O
// =============================================================================

/**
 * Write a surface map to disk as pretty-printed JSON.
 *
 * Creates parent directories if they don't exist.
 *
 * @param surfaceMap - The surface map to write
 * @param outputPath - Absolute path for the output file
 */
export async function writeSurfaceMap(
  surfaceMap: SurfaceMap,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const content = `${JSON.stringify(surfaceMap, null, 2)}\n`;
  await writeFile(outputPath, content, "utf-8");
}

/**
 * Read a surface map from disk.
 *
 * @param inputPath - Absolute path to the surface map file
 * @returns The parsed surface map
 */
export async function readSurfaceMap(inputPath: string): Promise<SurfaceMap> {
  const content = await readFile(inputPath, "utf-8");
  return JSON.parse(content) as SurfaceMap;
}
