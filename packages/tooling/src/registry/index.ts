/**
 * Registry Module
 *
 * Provides a shadcn-style registry for copying files into projects.
 *
 * @packageDocumentation
 */

export {
	FileEntrySchema,
	BlockSchema,
	RegistrySchema,
} from "./schema.js";

export type {
	FileEntry,
	Block,
	Registry,
	BlockDefinition,
	RegistryBuildConfig,
	AddBlockResult,
	AddBlockOptions,
} from "./schema.js";
