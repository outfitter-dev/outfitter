/**
 * Outfitter CLI - Programmatic API.
 *
 * This module exports the programmatic interface for the outfitter CLI,
 * allowing commands to be run from other code.
 *
 * @packageDocumentation
 */

// Init command
export { initCommand, runInit, type InitOptions, InitError } from "./commands/init";

// Action registry
export { outfitterActions } from "./actions.js";

// Doctor command
export {
	doctorCommand,
	runDoctor,
	printDoctorResults,
	type DoctorOptions,
	type DoctorResult,
	type DoctorSummary,
	type CheckResult,
	type BunVersionCheck,
	type PackageJsonCheck,
	type DependenciesCheck,
	type ConfigFilesCheck,
	type DirectoriesCheck,
} from "./commands/doctor";
