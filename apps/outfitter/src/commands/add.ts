/**
 * `outfitter add` - Add blocks from the registry to a project.
 *
 * Copies files from the registry into the user's project,
 * following a shadcn-style pattern where users own the files.
 *
 * @packageDocumentation
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult, Block, Registry } from "@outfitter/tooling";
import { RegistrySchema } from "@outfitter/tooling";
import { stampBlock } from "../manifest.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Input for the add command.
 */
export interface AddInput {
  /** Block name to add */
  readonly block: string;
  /** Overwrite existing files */
  readonly force: boolean;
  /** Show what would be done without making changes */
  readonly dryRun: boolean;
  /** Working directory (defaults to cwd) */
  readonly cwd?: string;
}

/**
 * Error returned when adding a block fails.
 */
export class AddError extends Error {
  readonly _tag = "AddError" as const;

  constructor(message: string) {
    super(message);
    this.name = "AddError";
  }
}

// =============================================================================
// Registry Loading
// =============================================================================

/**
 * Gets the path to the registry.json file.
 */
function getRegistryPath(): string {
  // Registry is bundled with @outfitter/tooling
  // Walk up from this file to find node_modules/@outfitter/tooling/registry
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i++) {
    const registryPath = join(
      currentDir,
      "node_modules/@outfitter/tooling/registry/registry.json"
    );
    if (existsSync(registryPath)) {
      return registryPath;
    }

    // Also check if we're in the monorepo and can access the package directly
    const monoRepoPath = join(
      currentDir,
      "packages/tooling/registry/registry.json"
    );
    if (existsSync(monoRepoPath)) {
      return monoRepoPath;
    }

    currentDir = dirname(currentDir);
  }

  throw new AddError(
    "Could not find registry.json. Ensure @outfitter/tooling is installed."
  );
}

/**
 * Reads the `@outfitter/tooling` package version from the same install tree
 * where the registry was resolved.
 *
 * @param registryPath - Absolute path to `registry/registry.json`
 * @returns The version string, or `"unknown"` if it cannot be read
 */
function readToolingVersion(registryPath: string): string {
  try {
    // registry lives at <tooling-root>/registry/registry.json
    const toolingRoot = dirname(dirname(registryPath));
    const pkgPath = join(toolingRoot, "package.json");
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Result of loading the registry, including the tooling version. */
interface LoadedRegistry {
  readonly registry: Registry;
  /** Version of `@outfitter/tooling` that provided the registry. */
  readonly toolingVersion: string;
}

/**
 * Loads and validates the registry.
 */
function loadRegistry(): Result<LoadedRegistry, AddError> {
  try {
    const registryPath = getRegistryPath();
    const content = readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    const registry = RegistrySchema.parse(parsed);
    const toolingVersion = readToolingVersion(registryPath);
    return Result.ok({ registry, toolingVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(new AddError(`Failed to load registry: ${message}`));
  }
}

// =============================================================================
// Block Resolution
// =============================================================================

/**
 * Resolves a block and all its extended blocks into a flat list of files and dependencies.
 */
function resolveBlock(
  registry: Registry,
  blockName: string,
  visited: Set<string> = new Set()
): Result<Block, AddError> {
  if (visited.has(blockName)) {
    return Result.err(
      new AddError(`Circular dependency detected for block: ${blockName}`)
    );
  }
  visited.add(blockName);

  const block = registry.blocks[blockName];
  if (!block) {
    const available = Object.keys(registry.blocks).join(", ");
    return Result.err(
      new AddError(
        `Block '${blockName}' not found. Available blocks: ${available}`
      )
    );
  }

  // If this block extends others, resolve them first
  if (block.extends && block.extends.length > 0) {
    const mergedFiles: Block["files"] = [];
    const mergedDeps: Record<string, string> = {};
    const mergedDevDeps: Record<string, string> = {};

    for (const extendedName of block.extends) {
      const extendedResult = resolveBlock(registry, extendedName, visited);
      if (extendedResult.isErr()) {
        return extendedResult;
      }

      const extended = extendedResult.value;
      if (extended.files) {
        mergedFiles.push(...extended.files);
      }
      if (extended.dependencies) {
        Object.assign(mergedDeps, extended.dependencies);
      }
      if (extended.devDependencies) {
        Object.assign(mergedDevDeps, extended.devDependencies);
      }
    }

    // Also include this block's own files if any
    if (block.files) {
      mergedFiles.push(...block.files);
    }
    if (block.dependencies) {
      Object.assign(mergedDeps, block.dependencies);
    }
    if (block.devDependencies) {
      Object.assign(mergedDevDeps, block.devDependencies);
    }

    return Result.ok({
      name: block.name,
      description: block.description,
      files: mergedFiles.length > 0 ? mergedFiles : undefined,
      dependencies: Object.keys(mergedDeps).length > 0 ? mergedDeps : undefined,
      devDependencies:
        Object.keys(mergedDevDeps).length > 0 ? mergedDevDeps : undefined,
    });
  }

  return Result.ok(block);
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Writes a file, creating directories as needed.
 */
function writeFile(
  filePath: string,
  content: string,
  executable: boolean
): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, "utf-8");
  if (executable) {
    chmodSync(filePath, 0o755);
  }
}

/**
 * Updates package.json with new dependencies.
 */
function updatePackageJson(
  cwd: string,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  dryRun: boolean
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const packageJsonPath = join(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    // No package.json, return what would be added
    return { dependencies, devDependencies };
  }

  const content = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(content) as Record<string, unknown>;

  const existingDeps = (pkg["dependencies"] ?? {}) as Record<string, string>;
  const existingDevDeps = (pkg["devDependencies"] ?? {}) as Record<
    string,
    string
  >;

  const addedDeps: Record<string, string> = {};
  const addedDevDeps: Record<string, string> = {};

  // Add dependencies that don't exist
  for (const [name, version] of Object.entries(dependencies)) {
    if (!existingDeps[name]) {
      existingDeps[name] = version;
      addedDeps[name] = version;
    }
  }

  // Add devDependencies that don't exist
  for (const [name, version] of Object.entries(devDependencies)) {
    if (!(existingDevDeps[name] || existingDeps[name])) {
      existingDevDeps[name] = version;
      addedDevDeps[name] = version;
    }
  }

  if (
    !dryRun &&
    (Object.keys(addedDeps).length > 0 || Object.keys(addedDevDeps).length > 0)
  ) {
    if (Object.keys(existingDeps).length > 0) {
      pkg["dependencies"] = existingDeps;
    }
    if (Object.keys(existingDevDeps).length > 0) {
      pkg["devDependencies"] = existingDevDeps;
    }
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  return { dependencies: addedDeps, devDependencies: addedDevDeps };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the add command programmatically.
 *
 * @param input - Add command input
 * @returns Result with details of what was added
 *
 * @example
 * ```typescript
 * const result = await runAdd({
 *   block: "scaffolding",
 *   force: false,
 *   dryRun: false,
 * });
 *
 * if (result.isOk()) {
 *   console.log(`Created ${result.value.created.length} files`);
 * }
 * ```
 */
export async function runAdd(
  input: AddInput
): Promise<Result<AddBlockResult, AddError>> {
  const { block: blockName, force, dryRun, cwd = process.cwd() } = input;
  const resolvedCwd = resolve(cwd);

  // Load registry
  const registryResult = loadRegistry();
  if (registryResult.isErr()) {
    return registryResult;
  }
  const { registry, toolingVersion } = registryResult.value;

  // Resolve block (handles extends)
  const blockResult = resolveBlock(registry, blockName);
  if (blockResult.isErr()) {
    return blockResult;
  }
  const block = blockResult.value;

  // Process files
  const created: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];

  if (block.files) {
    for (const file of block.files) {
      const targetPath = join(resolvedCwd, file.path);
      const fileExists = existsSync(targetPath);

      if (fileExists && !force) {
        skipped.push(file.path);
        continue;
      }

      if (!dryRun) {
        writeFile(targetPath, file.content, file.executable ?? false);
      }

      if (fileExists) {
        overwritten.push(file.path);
      } else {
        created.push(file.path);
      }
    }
  }

  // Update package.json dependencies
  const { dependencies, devDependencies } = updatePackageJson(
    resolvedCwd,
    block.dependencies ?? {},
    block.devDependencies ?? {},
    dryRun
  );

  // Stamp manifest (best-effort — block files are already written)
  if (!dryRun) {
    const stampResult = await stampBlock(
      resolvedCwd,
      blockName,
      toolingVersion
    );
    if (stampResult.isErr()) {
      // Log warning but don't fail the command
      process.stderr.write(
        `Warning: failed to stamp manifest: ${stampResult.error.message}\n`
      );
    }
  }

  return Result.ok({
    created,
    skipped,
    overwritten,
    dependencies,
    devDependencies,
  });
}

/**
 * Prints the results of the add command.
 */
export async function printAddResults(
  result: AddBlockResult,
  dryRun: boolean,
  options?: { mode?: OutputMode }
): Promise<void> {
  const mode = options?.mode;
  if (mode === "json" || mode === "jsonl") {
    await output(
      {
        dryRun,
        created: result.created,
        overwritten: result.overwritten,
        skipped: result.skipped,
        dependencies: result.dependencies,
        devDependencies: result.devDependencies,
      },
      { mode }
    );
    return;
  }

  const lines: string[] = [];
  const prefix = dryRun ? "[dry-run] Would " : "";

  if (result.created.length > 0) {
    lines.push(`${prefix}create ${result.created.length} file(s):`);
    for (const file of result.created) {
      lines.push(`  ✓ ${file}`);
    }
  }

  if (result.overwritten.length > 0) {
    lines.push(`${prefix}overwrite ${result.overwritten.length} file(s):`);
    for (const file of result.overwritten) {
      lines.push(`  ✓ ${file}`);
    }
  }

  if (result.skipped.length > 0) {
    lines.push(`Skipped ${result.skipped.length} existing file(s):`);
    for (const file of result.skipped) {
      lines.push(`  - ${file} (use --force to overwrite)`);
    }
  }

  const depCount =
    Object.keys(result.dependencies).length +
    Object.keys(result.devDependencies).length;

  if (depCount > 0) {
    lines.push("", `${prefix}add ${depCount} package(s) to package.json:`);
    for (const [name, version] of Object.entries(result.dependencies)) {
      lines.push(`  + ${name}@${version}`);
    }
    for (const [name, version] of Object.entries(result.devDependencies)) {
      lines.push(`  + ${name}@${version} (dev)`);
    }

    if (!dryRun) {
      lines.push("", "Run `bun install` to install new dependencies.");
    }
  }

  await output(lines);
}

/**
 * Lists available blocks.
 */
export function listBlocks(): Result<string[], AddError> {
  const registryResult = loadRegistry();
  if (registryResult.isErr()) {
    return registryResult;
  }

  const blocks = Object.keys(registryResult.value.registry.blocks);
  return Result.ok(blocks);
}
