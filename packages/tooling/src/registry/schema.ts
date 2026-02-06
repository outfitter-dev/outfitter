/**
 * Registry Schema
 *
 * Defines the structure for the shadcn-style registry that allows
 * users to copy files into their projects rather than installing dependencies.
 *
 * @packageDocumentation
 */

import { z, type ZodType } from "zod";

/**
 * File entry in a block.
 */
export interface FileEntry {
	/** Destination path relative to project root */
	path: string;
	/** File contents (embedded in registry) */
	content: string;
	/** Whether to chmod +x after copying */
	executable?: boolean | undefined;
	/** Whether to process as a template (future) */
	template?: boolean | undefined;
}

/**
 * Schema for a file entry in a block.
 * Represents a file that will be copied to the user's project.
 */
export const FileEntrySchema: ZodType<FileEntry> = z.object({
	path: z.string().min(1),
	content: z.string(),
	executable: z.boolean().optional(),
	template: z.boolean().optional(),
});

/**
 * Block in the registry.
 */
export interface Block {
	/** Block name (matches the key in blocks record) */
	name: string;
	/** Human-readable description */
	description: string;
	/** Files included in this block */
	files?: FileEntry[] | undefined;
	/** npm dependencies to add to package.json */
	dependencies?: Record<string, string> | undefined;
	/** npm devDependencies to add to package.json */
	devDependencies?: Record<string, string> | undefined;
	/** Other blocks this block extends (for composite blocks) */
	extends?: string[] | undefined;
}

/**
 * Schema for a block in the registry.
 * A block is a collection of related files that can be added together.
 */
export const BlockSchema: ZodType<Block> = z.object({
	name: z.string().min(1),
	description: z.string().min(1),
	files: z.array(FileEntrySchema).optional(),
	dependencies: z.record(z.string()).optional(),
	devDependencies: z.record(z.string()).optional(),
	extends: z.array(z.string()).optional(),
});

/**
 * Complete registry structure.
 */
export interface Registry {
	/** Registry schema version */
	version: string;
	/** Map of block name to block definition */
	blocks: Record<string, Block>;
}

/**
 * Schema for the complete registry.
 * Contains all available blocks with their files and metadata.
 */
export const RegistrySchema: ZodType<Registry> = z.object({
	version: z.string(),
	blocks: z.record(BlockSchema),
});

/**
 * Block definition used in the build script.
 * Specifies how to collect source files into a block.
 */
export interface BlockDefinition {
	/** Human-readable description */
	description: string;
	/** Source file paths (relative to repo root) */
	files?: string[];
	/** Remap source paths to destination paths */
	remap?: Record<string, string>;
	/** npm dependencies */
	dependencies?: Record<string, string>;
	/** npm devDependencies */
	devDependencies?: Record<string, string>;
	/** Other blocks this block extends */
	extends?: string[];
}

/**
 * Configuration for the registry build.
 */
export interface RegistryBuildConfig {
	/** Registry schema version */
	version: string;
	/** Block definitions */
	blocks: Record<string, BlockDefinition>;
}

/**
 * Result of adding a block to a project.
 */
export interface AddBlockResult {
	/** Files that were created */
	created: string[];
	/** Files that were skipped (already exist) */
	skipped: string[];
	/** Files that were overwritten (with --force) */
	overwritten: string[];
	/** Dependencies added to package.json */
	dependencies: Record<string, string>;
	/** devDependencies added to package.json */
	devDependencies: Record<string, string>;
}

/**
 * Options for the add command.
 */
export interface AddBlockOptions {
	/** Overwrite existing files */
	force?: boolean;
	/** Show what would be added without making changes */
	dryRun?: boolean;
	/** Working directory (defaults to cwd) */
	cwd?: string;
}
