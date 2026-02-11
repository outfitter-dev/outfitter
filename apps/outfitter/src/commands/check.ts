/**
 * `outfitter check` - Compare local config blocks against the registry.
 *
 * Reads the manifest to determine which blocks are installed, then compares
 * each block's local files against the registry's canonical versions.
 * Uses structural comparison for JSON files and string comparison for others.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { output } from "@outfitter/cli/output";
import { createTheme } from "@outfitter/cli/render";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { FileEntry, Registry } from "@outfitter/tooling";
import { RegistrySchema } from "@outfitter/tooling";
import { readManifest } from "../manifest.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the check command.
 */
export interface CheckOptions {
  /** Working directory to check. */
  readonly cwd: string;
  /** Show diff information for drifted files. */
  readonly verbose?: boolean;
  /** Check a specific block only. */
  readonly block?: string;
  /** Machine-oriented output for CI. */
  readonly ci?: boolean;
  /** Output mode override. */
  readonly outputMode?: OutputMode;
}

/**
 * Information about a drifted file (included in verbose mode).
 */
export interface DriftedFileInfo {
  /** File path relative to project root. */
  readonly path: string;
  /** Reason for drift classification. */
  readonly reason: "modified" | "missing";
}

/**
 * Status of a single block after comparison.
 */
export interface BlockCheckStatus {
  /** Block name. */
  readonly name: string;
  /** Comparison result. */
  readonly status: "current" | "drifted" | "missing";
  /** Tooling version the block was installed from. */
  readonly installedFrom?: string;
  /** Current tooling version providing the registry. */
  readonly currentToolingVersion?: string;
  /** Drifted file details (populated when verbose is true). */
  readonly driftedFiles?: DriftedFileInfo[];
}

/**
 * Complete result of the check command.
 */
export interface CheckResult {
  /** Per-block comparison results. */
  readonly blocks: BlockCheckStatus[];
  /** Number of blocks checked. */
  readonly totalChecked: number;
  /** Number of blocks matching the registry. */
  readonly currentCount: number;
  /** Number of blocks with local modifications. */
  readonly driftedCount: number;
  /** Number of blocks with missing files. */
  readonly missingCount: number;
}

/**
 * Error returned when the check command fails.
 */
export class CheckError extends Error {
  readonly _tag = "CheckError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckError";
  }
}

// =============================================================================
// Registry Loading (shared logic with add.ts)
// =============================================================================

/**
 * Gets the path to the registry.json file.
 */
function getRegistryPath(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i++) {
    const registryPath = join(
      currentDir,
      "node_modules/@outfitter/tooling/registry/registry.json"
    );
    if (existsSync(registryPath)) {
      return registryPath;
    }

    const monoRepoPath = join(
      currentDir,
      "packages/tooling/registry/registry.json"
    );
    if (existsSync(monoRepoPath)) {
      return monoRepoPath;
    }

    currentDir = dirname(currentDir);
  }

  throw new CheckError(
    "Could not find registry.json. Ensure @outfitter/tooling is installed."
  );
}

/**
 * Reads the `@outfitter/tooling` package version.
 */
function readToolingVersion(registryPath: string): string {
  try {
    const toolingRoot = dirname(dirname(registryPath));
    const pkgPath = join(toolingRoot, "package.json");
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Result of loading the registry. */
interface LoadedRegistry {
  readonly registry: Registry;
  readonly toolingVersion: string;
}

/**
 * Loads and validates the registry.
 */
function loadRegistry(): Result<LoadedRegistry, CheckError> {
  try {
    const registryPath = getRegistryPath();
    const content = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    const registry = RegistrySchema.parse(parsed);
    const toolingVersion = readToolingVersion(registryPath);
    return Result.ok({ registry, toolingVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(new CheckError(`Failed to load registry: ${message}`));
  }
}

// =============================================================================
// Block Resolution
// =============================================================================

/**
 * Resolves a block into a flat list of files (handles extends).
 */
function resolveBlockFiles(
  registry: Registry,
  blockName: string,
  visited: Set<string> = new Set()
): FileEntry[] {
  if (visited.has(blockName)) {
    return [];
  }
  visited.add(blockName);

  const block = registry.blocks[blockName];
  if (!block) {
    return [];
  }

  const files: FileEntry[] = [];

  // Resolve extended blocks first
  if (block.extends && block.extends.length > 0) {
    for (const extendedName of block.extends) {
      files.push(...resolveBlockFiles(registry, extendedName, visited));
    }
  }

  // Add this block's own files
  if (block.files) {
    files.push(...block.files);
  }

  return files;
}

// =============================================================================
// Comparison Logic
// =============================================================================

/**
 * Performs deep structural comparison of two values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!Object.hasOwn(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * Compares two file contents.
 * Uses structural comparison for JSON files, string comparison for all others.
 */
function compareFileContent(
  filePath: string,
  localContent: string,
  registryContent: string
): boolean {
  // JSON structural comparison
  if (filePath.endsWith(".json") || filePath.endsWith(".jsonc")) {
    try {
      // Strip JSONC comments for .jsonc files
      const cleanLocal = filePath.endsWith(".jsonc")
        ? stripJsoncComments(localContent)
        : localContent;
      const cleanRegistry = filePath.endsWith(".jsonc")
        ? stripJsoncComments(registryContent)
        : registryContent;

      const localParsed = JSON.parse(cleanLocal);
      const registryParsed = JSON.parse(cleanRegistry);
      return deepEqual(localParsed, registryParsed);
    } catch {
      // If JSON parsing fails, fall through to string comparison
    }
  }

  // String comparison for all other files
  return localContent === registryContent;
}

/**
 * Strips single-line (//) comments from JSONC content for comparison.
 * Tracks string boundaries to avoid stripping `//` inside string values.
 */
function stripJsoncComments(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        // Toggle string state on unescaped double quotes
        if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
          inString = !inString;
        }
        // Strip from // onward when outside a string
        if (!inString && char === "/" && line[i + 1] === "/") {
          return line.slice(0, i).trimEnd();
        }
      }
      return line;
    })
    .filter((line) => line.trim() !== "")
    .join("\n");
}

// =============================================================================
// File-Presence Heuristic
// =============================================================================

/**
 * Known file paths that map to registry blocks.
 * Used as fallback when no manifest exists.
 */
const BLOCK_FILE_MARKERS: Record<string, string[]> = {
  biome: ["biome.json"],
  lefthook: [".lefthook.yml"],
  claude: [".claude/settings.json"],
  markdownlint: [".markdownlint-cli2.jsonc"],
  bootstrap: ["scripts/bootstrap.sh"],
};

/**
 * Detects installed blocks by scanning for known file markers.
 */
function detectBlocksByFilePresence(cwd: string): string[] {
  const detected: string[] = [];

  for (const [blockName, files] of Object.entries(BLOCK_FILE_MARKERS)) {
    const hasAnyFile = files.some((filePath) =>
      existsSync(join(cwd, filePath))
    );
    if (hasAnyFile) {
      detected.push(blockName);
    }
  }

  return detected;
}

// =============================================================================
// Check Logic
// =============================================================================

/**
 * Checks a single block against the registry.
 */
function checkBlock(
  cwd: string,
  blockName: string,
  registry: Registry,
  toolingVersion: string,
  installedFrom: string | undefined,
  verbose: boolean
): BlockCheckStatus {
  const versionFields = {
    ...(installedFrom !== undefined ? { installedFrom } : {}),
    currentToolingVersion: toolingVersion,
  };

  const files = resolveBlockFiles(registry, blockName);

  // Block not found in registry — classify as missing
  if (files.length === 0 && !registry.blocks[blockName]) {
    return {
      name: blockName,
      status: "missing",
      ...versionFields,
    };
  }

  // If no files to check (e.g. composite block with no own files),
  // and it exists in registry, count as current
  if (files.length === 0) {
    return {
      name: blockName,
      status: "current",
      ...versionFields,
    };
  }

  let allMissing = true;
  let anyDrifted = false;
  const driftedFiles: DriftedFileInfo[] = [];

  for (const file of files) {
    const localPath = join(cwd, file.path);

    if (!existsSync(localPath)) {
      // allMissing stays true (file is absent)
      anyDrifted = true;
      if (verbose) {
        driftedFiles.push({ path: file.path, reason: "missing" });
      }
      continue;
    }

    allMissing = false;
    const localContent = readFileSync(localPath, "utf-8");

    if (!compareFileContent(file.path, localContent, file.content)) {
      anyDrifted = true;
      if (verbose) {
        driftedFiles.push({ path: file.path, reason: "modified" });
      }
    }
  }

  // If ALL files are missing, classify the block as missing
  if (allMissing) {
    return {
      name: blockName,
      status: "missing",
      ...versionFields,
      ...(verbose && driftedFiles.length > 0 ? { driftedFiles } : {}),
    };
  }

  // If any file is drifted or missing, classify the block as drifted
  if (anyDrifted) {
    return {
      name: blockName,
      status: "drifted",
      ...versionFields,
      ...(verbose && driftedFiles.length > 0 ? { driftedFiles } : {}),
    };
  }

  return {
    name: blockName,
    status: "current",
    ...versionFields,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the check command programmatically.
 *
 * Reads the manifest (or falls back to file-presence heuristic) and
 * compares each installed block against the registry.
 *
 * @param options - Check command options
 * @returns Result with per-block comparison statuses
 *
 * @example
 * ```typescript
 * const result = await runCheck({ cwd: process.cwd() });
 * if (result.isOk()) {
 *   if (result.value.driftedCount > 0) {
 *     console.log("Some blocks have drifted from the registry");
 *   }
 * }
 * ```
 */
export async function runCheck(
  options: CheckOptions
): Promise<Result<CheckResult, CheckError>> {
  const { cwd: rawCwd, verbose = false, block: blockFilter } = options;
  const cwd = resolve(rawCwd);

  // Load registry
  const registryResult = loadRegistry();
  if (registryResult.isErr()) {
    return registryResult;
  }
  const { registry, toolingVersion } = registryResult.value;

  // Read manifest (or fall back to heuristic)
  const manifestResult = await readManifest(cwd);
  if (manifestResult.isErr()) {
    return Result.err(
      new CheckError(`Failed to read manifest: ${manifestResult.error.message}`)
    );
  }

  const manifest = manifestResult.value;

  // Determine which blocks to check
  let blocksToCheck: Array<{
    name: string;
    installedFrom: string | undefined;
  }>;

  if (manifest) {
    // Use manifest entries
    blocksToCheck = Object.entries(manifest.blocks).map(([name, entry]) => ({
      name,
      installedFrom: entry.installedFrom,
    }));
  } else {
    // Fallback: detect blocks by file presence
    const detected = detectBlocksByFilePresence(cwd);
    blocksToCheck = detected.map((name) => ({
      name,
      installedFrom: undefined,
    }));
  }

  // Apply block filter if specified
  if (blockFilter) {
    blocksToCheck = blocksToCheck.filter((b) => b.name === blockFilter);
  }

  // Check each block
  const blocks: BlockCheckStatus[] = [];
  for (const { name, installedFrom } of blocksToCheck) {
    blocks.push(
      checkBlock(cwd, name, registry, toolingVersion, installedFrom, verbose)
    );
  }

  // Compute summary
  const currentCount = blocks.filter((b) => b.status === "current").length;
  const driftedCount = blocks.filter((b) => b.status === "drifted").length;
  const missingCount = blocks.filter((b) => b.status === "missing").length;

  return Result.ok({
    blocks,
    totalChecked: blocks.length,
    currentCount,
    driftedCount,
    missingCount,
  });
}

/**
 * Formats and outputs check results.
 */
export async function printCheckResults(
  result: CheckResult,
  options?: { mode?: OutputMode; verbose?: boolean }
): Promise<void> {
  const mode = options?.mode;

  if (mode === "json" || mode === "jsonl") {
    await output(result, { mode });
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];

  lines.push("");
  lines.push("Outfitter Check");
  lines.push("=".repeat(50));
  lines.push("");

  for (const block of result.blocks) {
    let statusIcon: string;

    switch (block.status) {
      case "current":
        statusIcon = theme.success("[PASS]");
        break;
      case "drifted":
        statusIcon = theme.error("[DRIFT]");
        break;
      case "missing":
        statusIcon = theme.warning("[MISSING]");
        break;
      default:
        statusIcon = "[?]";
    }

    const versionInfo = block.installedFrom
      ? ` (installed from ${block.installedFrom})`
      : "";
    lines.push(`${statusIcon} ${block.name}${versionInfo}`);

    // Show drifted file details in verbose mode
    if (options?.verbose && block.driftedFiles) {
      for (const file of block.driftedFiles) {
        const reason = file.reason === "missing" ? "file missing" : "modified";
        lines.push(`       ${theme.muted(`${file.path}: ${reason}`)}`);
      }
    }
  }

  lines.push("");
  lines.push("=".repeat(50));

  const summaryColor =
    result.driftedCount === 0 && result.missingCount === 0
      ? theme.success
      : theme.error;

  lines.push(
    summaryColor(`${result.currentCount}/${result.totalChecked} blocks current`)
  );

  if (result.driftedCount > 0) {
    lines.push(theme.muted(`${result.driftedCount} block(s) have drifted`));
  }
  if (result.missingCount > 0) {
    lines.push(
      theme.muted(`${result.missingCount} block(s) have missing files`)
    );
  }

  if (result.driftedCount > 0 || result.missingCount > 0) {
    lines.push("");
    lines.push(
      theme.muted(
        "Run 'outfitter add <block> --force' to restore registry defaults."
      )
    );
  }

  await output(lines);
}
