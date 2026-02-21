/**
 * Manifest schema and read/write utilities.
 *
 * Tracks which config blocks were installed and from which tooling version.
 * Stored at `.outfitter/manifest.json` in the project root.
 *
 * @packageDocumentation
 */

import { join } from "node:path";
import {
  InternalError,
  type OutfitterError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import { type ZodType, z } from "zod";

// =============================================================================
// Constants
// =============================================================================

/** Directory name for Outfitter metadata. */
const OUTFITTER_DIR = ".outfitter";

/** Manifest file name within the Outfitter directory. */
const MANIFEST_FILE = "manifest.json";

// =============================================================================
// Types
// =============================================================================

/** A single block entry in the manifest. */
export interface BlockEntry {
  /** ISO 8601 timestamp of when the block was installed or last updated. */
  installedAt: string;
  /** Tooling version the block was installed from. */
  installedFrom: string;
}

/** The full manifest structure. */
export interface Manifest {
  /** Map of block name to install metadata. */
  blocks: Record<string, BlockEntry>;
  /** Manifest format version. Currently always 1. */
  version: 1;
}

// =============================================================================
// Schema
// =============================================================================

/**
 * Schema for a single block entry in the manifest.
 */
export const BlockEntrySchema: ZodType<BlockEntry> = z.object({
  installedFrom: z.string(),
  installedAt: z.string().datetime(),
});

/**
 * Schema for the manifest file.
 */
export const ManifestSchema: ZodType<Manifest> = z.object({
  version: z.literal(1),
  blocks: z.record(z.string(), BlockEntrySchema),
});

// =============================================================================
// Utilities
// =============================================================================

/**
 * Returns the path to the manifest file for the given working directory.
 */
function manifestPath(cwd: string): string {
  return join(cwd, OUTFITTER_DIR, MANIFEST_FILE);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Reads and validates `.outfitter/manifest.json`.
 *
 * @param cwd - Working directory containing the `.outfitter/` folder
 * @returns The parsed manifest, or `null` if the file does not exist
 *
 * @example
 * ```typescript
 * const result = await readManifest(process.cwd());
 * if (result.isOk() && result.value) {
 *   console.log(result.value.blocks);
 * }
 * ```
 */
export async function readManifest(
  cwd: string
): Promise<Result<Manifest | null, OutfitterError>> {
  const path = manifestPath(cwd);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return Result.ok(null);
  }

  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return Result.err(
      InternalError.create("Failed to read manifest file", { path })
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Result.err(
      ValidationError.create("manifest", "Invalid JSON in manifest file")
    );
  }

  const validated = ManifestSchema.safeParse(parsed);
  if (!validated.success) {
    return Result.err(
      ValidationError.create(
        "manifest",
        "Manifest file does not match expected schema"
      )
    );
  }

  return Result.ok(validated.data);
}

/**
 * Writes a manifest to `.outfitter/manifest.json`.
 *
 * Creates the `.outfitter/` directory if it does not exist.
 * Writes atomically via `Bun.write`.
 *
 * @param cwd - Working directory to write the manifest into
 * @param manifest - The manifest data to write
 *
 * @example
 * ```typescript
 * await writeManifest(process.cwd(), { version: 1, blocks: {} });
 * ```
 */
export async function writeManifest(
  cwd: string,
  manifest: Manifest
): Promise<Result<void, OutfitterError>> {
  const dirPath = join(cwd, OUTFITTER_DIR);
  const path = join(dirPath, MANIFEST_FILE);

  try {
    const { mkdirSync, existsSync, statSync } = await import("node:fs");
    if (existsSync(dirPath)) {
      if (!statSync(dirPath).isDirectory()) {
        return Result.err(
          ValidationError.create(
            "manifest",
            ".outfitter exists but is not a directory"
          )
        );
      }
    } else {
      mkdirSync(dirPath, { recursive: true });
    }

    const content = JSON.stringify(manifest, null, "\t");
    await Bun.write(path, `${content}\n`);
    return Result.ok(undefined);
  } catch {
    return Result.err(
      InternalError.create("Failed to write manifest file", { path })
    );
  }
}

/**
 * Adds or updates a block entry in the manifest (read-modify-write).
 *
 * If no manifest exists, creates a new one. If the block already exists,
 * updates its `installedFrom` and `installedAt` fields.
 *
 * @param cwd - Working directory containing the project
 * @param blockName - Name of the block to stamp
 * @param toolingVersion - Version of the tooling package the block was installed from
 *
 * @example
 * ```typescript
 * await stampBlock(process.cwd(), "biome", "0.2.1");
 * ```
 */
export async function stampBlock(
  cwd: string,
  blockName: string,
  toolingVersion: string
): Promise<Result<void, OutfitterError>> {
  const readResult = await readManifest(cwd);
  if (readResult.isErr()) {
    return readResult;
  }

  const existing = readResult.value;
  const manifest: Manifest = existing ?? { version: 1, blocks: {} };

  const updated: Manifest = {
    ...manifest,
    blocks: {
      ...manifest.blocks,
      [blockName]: {
        installedFrom: toolingVersion,
        installedAt: new Date().toISOString(),
      },
    },
  };

  return writeManifest(cwd, updated);
}
