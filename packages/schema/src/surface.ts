/**
 * Surface map generation and I/O.
 *
 * A surface map extends the action manifest with envelope metadata
 * for build-time generation, file persistence, and drift detection.
 *
 * @packageDocumentation
 */

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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

function comparableSurfaceMap(
  surfaceMap: SurfaceMap
): Omit<SurfaceMap, "generatedAt"> {
  const { generatedAt: _generatedAt, ...comparable } = surfaceMap;
  return comparable;
}

function stableJsonString(value: unknown): string {
  if (value === undefined) {
    return "null";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonString(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .filter(([, nestedValue]) => nestedValue !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, nestedValue]) =>
        `${JSON.stringify(key)}:${stableJsonString(nestedValue)}`
    )
    .join(",")}}`;
}

function canonicalizeSurfaceMapContent(
  content: string,
  outputPath: string
): string {
  const formatResult = spawnSync(
    "bun",
    ["x", "oxfmt", "--stdin-filepath", outputPath],
    {
      encoding: "utf-8",
      input: content,
    }
  );

  if (
    formatResult.status !== 0 ||
    typeof formatResult.stdout !== "string" ||
    formatResult.stdout.length === 0
  ) {
    return content.endsWith("\n") ? content : `${content}\n`;
  }

  return formatResult.stdout.endsWith("\n")
    ? formatResult.stdout
    : `${formatResult.stdout}\n`;
}

function serializeSurfaceMap(
  surfaceMap: SurfaceMap,
  outputPath: string
): string {
  return canonicalizeSurfaceMapContent(
    `${JSON.stringify(surfaceMap, null, 2)}\n`,
    outputPath
  );
}

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
  let nextSurfaceMap = surfaceMap;
  let nextContent: string | undefined;

  try {
    const existingContent = await readFile(outputPath, "utf-8");
    const existingSurfaceMap = JSON.parse(existingContent) as SurfaceMap;

    if (
      stableJsonString(comparableSurfaceMap(existingSurfaceMap)) ===
      stableJsonString(comparableSurfaceMap(surfaceMap))
    ) {
      nextSurfaceMap = {
        ...surfaceMap,
        generatedAt: existingSurfaceMap.generatedAt,
      };

      nextContent = serializeSurfaceMap(nextSurfaceMap, outputPath);
      if (nextContent === existingContent) {
        return;
      }
    }
  } catch {
    // Missing or unreadable files are rewritten from scratch.
  }

  await writeFile(
    outputPath,
    nextContent ?? serializeSurfaceMap(nextSurfaceMap, outputPath),
    "utf-8"
  );
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

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Resolve the file path for a named snapshot.
 *
 * @param cwd - Project root directory
 * @param outputDir - Output directory name (e.g., ".outfitter")
 * @param version - Snapshot version label
 * @returns Absolute path to the snapshot file
 */
export function resolveSnapshotPath(
  cwd: string,
  outputDir: string,
  version: string
): string {
  return join(cwd, outputDir, "snapshots", `${version}.json`);
}
