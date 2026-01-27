/**
 * Outfitter CLI - Programmatic API.
 *
 * This module exports the programmatic interface for the outfitter CLI,
 * allowing commands to be run from other code.
 *
 * @packageDocumentation
 */

// Action registry
export { outfitterActions } from "./actions.js";
// Doctor command
export {
  type BunVersionCheck,
  type CheckResult,
  type ConfigFilesCheck,
  type DependenciesCheck,
  type DirectoriesCheck,
  type DoctorOptions,
  type DoctorResult,
  type DoctorSummary,
  doctorCommand,
  type PackageJsonCheck,
  printDoctorResults,
  runDoctor,
} from "./commands/doctor";
// Init command
export {
  InitError,
  type InitOptions,
  initCommand,
  runInit,
} from "./commands/init";
