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
// Create command
export {
  CreateError,
  type CreateOptions,
  type CreateResult,
  type CreateStructure,
  createCommand,
  printCreateResults,
  runCreate,
} from "./commands/create.js";
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
} from "./commands/doctor.js";
// Init command
export {
  InitError,
  type InitOptions,
  initCommand,
  runInit,
} from "./commands/init.js";

// Create planner
export {
  CREATE_PRESET_IDS,
  CREATE_PRESETS,
  type CreatePlanChange,
  type CreatePresetDefinition,
  type CreatePresetId,
  type CreateProjectInput,
  type CreateProjectPlan,
  getCreatePreset,
  planCreateProject,
} from "./create/index.js";
