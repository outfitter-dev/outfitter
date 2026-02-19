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
} from "./commands/doctor.js";
// Init command
export {
  InitError,
  type InitOptions,
  type InitPresetId,
  type InitResult,
  type InitStructure,
  initCommand,
  printInitResults,
  runInit,
} from "./commands/init.js";
// Repo maintenance command
export {
  type CreateRepoCommandOptions,
  createRepoCommand,
  type RepoCheckSubject,
  type RepoCommandIo,
  type RepoToolingInvocation,
} from "./commands/repo.js";
// Scaffold command
export {
  printScaffoldResults,
  runScaffold,
  ScaffoldCommandError,
  type ScaffoldCommandResult,
  type ScaffoldOptions,
  scaffoldCommand,
} from "./commands/scaffold.js";

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
export type {
  TargetCategory,
  TargetDefinition,
  TargetId,
  TargetScope,
  TargetStatus,
} from "./targets/index.js";
// Targets registry
export {
  getInitTarget,
  getReadyTarget,
  getScaffoldTarget,
  getTarget,
  INIT_TARGET_IDS,
  listTargets,
  READY_TARGET_IDS,
  resolvePlacement,
  SCAFFOLD_TARGET_IDS,
  TARGET_IDS,
  TARGET_REGISTRY,
} from "./targets/index.js";
