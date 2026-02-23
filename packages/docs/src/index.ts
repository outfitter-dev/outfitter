/**
 * @outfitter/docs
 *
 * CLI and host command adapter for Outfitter docs workflows.
 *
 * @packageDocumentation
 */

export type { CreateDocsCommandOptions } from "./command/create-docs-command.js";
export { createDocsCommand } from "./command/create-docs-command.js";
export type {
  DocsCommonCliOptions,
  DocsExportCliOptions,
  DocsMdxMode,
} from "./command/docs-option-bundle.js";
export {
  DOCS_COMMON_OPTION_FLAGS,
  DOCS_EXPORT_OPTION_FLAGS,
  resolveDocsCliOptions,
  withDocsCommonOptions,
  withDocsExportOptions,
} from "./command/docs-option-bundle.js";
export {
  type ExecuteCheckCommandOptions,
  executeCheckCommand,
} from "./commands/check.js";
export {
  type DocsExportTarget,
  type ExecuteExportCommandOptions,
  executeExportCommand,
} from "./commands/export.js";
export {
  type ExecuteSyncCommandOptions,
  executeSyncCommand,
} from "./commands/sync.js";
export {
  type GenerateDocsMapOptions,
  generateDocsMap,
  readDocsMap,
  writeDocsMap,
} from "./core/docs-map-generator.js";
export {
  type DocKind,
  DocKindSchema,
  type DocsMap,
  type DocsMapEntry,
  DocsMapEntrySchema,
  DocsMapSchema,
} from "./core/docs-map-schema.js";
export type {
  CheckLlmsDocsResult,
  CheckPackageDocsResult,
  DocsDrift,
  DocsWarning,
  DriftKind,
  LlmsDocsOptions,
  LlmsTarget,
  MdxMode,
  PackageDocsOptions,
  SyncLlmsDocsResult,
  SyncPackageDocsResult,
} from "./core/index.js";
export {
  checkLlmsDocs,
  checkPackageDocs,
  DocsCoreError,
  syncLlmsDocs,
  syncPackageDocs,
} from "./core/index.js";
