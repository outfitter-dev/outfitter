#!/usr/bin/env bun
/**
 * Registry Build Script
 *
 * Collects source files from the repository and generates registry.json.
 * Run from the repository root: bun run packages/tooling/src/registry/build.ts
 *
 * @packageDocumentation
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getResolvedVersions } from "@outfitter/presets";

import type {
  Block,
  BlockDefinition,
  Registry,
  RegistryBuildConfig,
} from "./schema.js";

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Find the repository root by looking for package.json with workspaces
 */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== "/") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.workspaces) {
        return dir;
      }
    }
    dir = dirname(dir);
  }
  throw new Error("Could not find repository root");
}

/**
 * Check if a file is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    // Check if owner has execute permission (0o100)
    return (stats.mode & 0o100) !== 0;
  } catch {
    return false;
  }
}

/**
 * Read file content and detect if it's executable
 */
function readFileEntry(
  repoRoot: string,
  sourcePath: string,
  destPath: string
): { path: string; content: string; executable?: boolean } {
  const fullPath = join(repoRoot, sourcePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }

  const content = readFileSync(fullPath, "utf-8");
  const executable = isExecutable(fullPath);

  return {
    path: destPath,
    content,
    ...(executable && { executable: true }),
  };
}

/**
 * Build a single block from its definition
 */
function buildBlock(
  repoRoot: string,
  name: string,
  def: BlockDefinition
): Block {
  const block: Block = {
    name,
    description: def.description,
  };

  // Handle file-based blocks
  if (def.files && def.files.length > 0) {
    block.files = def.files.map((sourcePath) => {
      const destPath = def.remap?.[sourcePath] ?? sourcePath;
      return readFileEntry(repoRoot, sourcePath, destPath);
    });
  }

  // Add dependencies
  if (def.dependencies && Object.keys(def.dependencies).length > 0) {
    block.dependencies = def.dependencies;
  }

  if (def.devDependencies && Object.keys(def.devDependencies).length > 0) {
    block.devDependencies = def.devDependencies;
  }

  // Handle composite blocks
  if (def.extends && def.extends.length > 0) {
    block.extends = def.extends;
  }

  return block;
}

/**
 * Build the complete registry from configuration
 */
function buildRegistry(
  config: RegistryBuildConfig,
  repoRoot: string
): Registry {
  const blocks: Record<string, Block> = {};

  for (const [name, def] of Object.entries(config.blocks)) {
    blocks[name] = buildBlock(repoRoot, name, def);
  }

  return {
    version: config.version,
    blocks,
  };
}

/**
 * Resolve a version from the presets package, throwing if not found.
 */
function resolveVersion(
  versions: Readonly<Record<string, string>>,
  name: string
): string {
  const version = versions[name];
  if (!version) {
    throw new Error(
      `Missing resolved version for "${name}" in @outfitter/presets`
    );
  }
  return version;
}

function getWorkspacePackageVersion(relativePackageJsonPath: string): string {
  const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    relativePackageJsonPath
  );
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    version?: unknown;
  };

  if (typeof pkg.version !== "string") {
    throw new Error(`Expected version in package.json at ${pkgPath}`);
  }

  return `^${pkg.version}`;
}

/**
 * Read the tooling package's own version for self-referencing in registry blocks.
 */
function getToolingVersion(): string {
  return getWorkspacePackageVersion("../../package.json");
}

/**
 * Read the local @outfitter/oxlint-plugin version for linter registry blocks.
 */
function getOxlintPluginVersion(): string {
  return getWorkspacePackageVersion("../../../oxlint-plugin/package.json");
}

/**
 * Build the registry configuration with versions resolved from @outfitter/presets.
 */
function createRegistryConfig(): RegistryBuildConfig {
  const { all: versions } = getResolvedVersions();
  const toolingVersion = getToolingVersion();
  const oxlintPluginVersion = getOxlintPluginVersion();

  return {
    version: "1.0.0",
    blocks: {
      claude: {
        description: "Claude Code settings and hooks for automated formatting",
        files: [
          ".claude/settings.json",
          ".claude/hooks/format-code-on-stop.sh",
        ],
      },
      linter: {
        description:
          "Linter and formatter configuration (oxlint/oxfmt) via Ultracite",
        files: [
          "packages/tooling/configs/.oxlintrc.json",
          "packages/tooling/configs/.oxfmtrc.jsonc",
        ],
        remap: {
          "packages/tooling/configs/.oxlintrc.json": ".oxlintrc.json",
          "packages/tooling/configs/.oxfmtrc.jsonc": ".oxfmtrc.jsonc",
        },
        devDependencies: {
          "@outfitter/oxlint-plugin": oxlintPluginVersion,
          ultracite: resolveVersion(versions, "ultracite"),
          oxlint: resolveVersion(versions, "oxlint"),
          oxfmt: resolveVersion(versions, "oxfmt"),
        },
      },
      lefthook: {
        description: "Git hooks via Lefthook for pre-commit and pre-push",
        files: ["packages/tooling/lefthook.yml"],
        remap: { "packages/tooling/lefthook.yml": ".lefthook.yml" },
        devDependencies: {
          "@outfitter/tooling": toolingVersion,
          lefthook: resolveVersion(versions, "lefthook"),
          ultracite: resolveVersion(versions, "ultracite"),
        },
      },
      markdownlint: {
        description: "Markdown linting configuration via markdownlint-cli2",
        files: ["packages/tooling/.markdownlint-cli2.jsonc"],
        remap: {
          "packages/tooling/.markdownlint-cli2.jsonc":
            ".markdownlint-cli2.jsonc",
        },
      },
      bootstrap: {
        description:
          "Project bootstrap script for installing tools and dependencies",
        files: ["packages/tooling/templates/bootstrap.sh"],
        remap: {
          "packages/tooling/templates/bootstrap.sh": "scripts/bootstrap.sh",
        },
      },
      scaffolding: {
        description:
          "Full starter kit: Claude settings, oxlint/oxfmt, Lefthook, markdownlint, and bootstrap script",
        extends: ["claude", "linter", "lefthook", "markdownlint", "bootstrap"],
      },
    },
  };
}

/** Registry build configuration with dynamically resolved versions. */
export const REGISTRY_CONFIG: RegistryBuildConfig = createRegistryConfig();

/**
 * Main entry point
 */
function main(): void {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const repoRoot = findRepoRoot(scriptDir);
  const outputDir = join(repoRoot, "packages/tooling/registry");
  const outputPath = join(outputDir, "registry.json");

  log(`Building registry from: ${repoRoot}`);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build and write registry
  const registry = buildRegistry(REGISTRY_CONFIG, repoRoot);
  writeFileSync(outputPath, `${JSON.stringify(registry, null, "\t")}\n`);

  // Summary
  const blockCount = Object.keys(registry.blocks).length;
  const fileCount = Object.values(registry.blocks).flatMap(
    (b) => b.files ?? []
  ).length;

  log(`✓ Generated ${outputPath}`);
  log(`  ${blockCount} blocks, ${fileCount} files embedded`);
}

if (import.meta.main) {
  main();
}
