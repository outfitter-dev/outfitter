#!/usr/bin/env bun
/**
 * Registry Build Script
 *
 * Collects source files from the repository and generates registry.json.
 * Run from the repository root: bun run packages/tooling/src/registry/build.ts
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Block, BlockDefinition, Registry, RegistryBuildConfig } from "./schema.js";

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
function buildRegistry(config: RegistryBuildConfig, repoRoot: string): Registry {
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
 * Registry build configuration
 */
const REGISTRY_CONFIG: RegistryBuildConfig = {
	version: "1.0.0",
	blocks: {
		claude: {
			description: "Claude Code settings and hooks for automated formatting",
			files: [
				".claude/settings.json",
				".claude/hooks/format-code-on-stop.sh",
			],
		},
		biome: {
			description: "Biome linter/formatter configuration via Ultracite",
			files: ["packages/tooling/biome.json"],
			remap: { "packages/tooling/biome.json": "biome.json" },
			devDependencies: { ultracite: "^7.0.0" },
		},
		lefthook: {
			description: "Git hooks via Lefthook for pre-commit and pre-push",
			files: ["packages/tooling/lefthook.yml"],
			remap: { "packages/tooling/lefthook.yml": ".lefthook.yml" },
			devDependencies: { lefthook: "^2.0.0" },
		},
		bootstrap: {
			description: "Project bootstrap script for installing tools and dependencies",
			files: ["scripts/bootstrap.sh"],
		},
		scaffolding: {
			description: "Full starter kit: Claude settings, Biome, Lefthook, and bootstrap script",
			extends: ["claude", "biome", "lefthook", "bootstrap"],
		},
	},
};

/**
 * Main entry point
 */
function main(): void {
	const scriptDir = dirname(new URL(import.meta.url).pathname);
	const repoRoot = findRepoRoot(scriptDir);
	const outputDir = join(repoRoot, "packages/tooling/registry");
	const outputPath = join(outputDir, "registry.json");

	console.log(`Building registry from: ${repoRoot}`);

	// Ensure output directory exists
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	// Build and write registry
	const registry = buildRegistry(REGISTRY_CONFIG, repoRoot);
	writeFileSync(outputPath, JSON.stringify(registry, null, 2) + "\n");

	// Summary
	const blockCount = Object.keys(registry.blocks).length;
	const fileCount = Object.values(registry.blocks)
		.flatMap((b) => b.files ?? [])
		.length;

	console.log(`✓ Generated ${outputPath}`);
	console.log(`  ${blockCount} blocks, ${fileCount} files embedded`);
}

main();
