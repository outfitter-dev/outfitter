// eslint-disable-next-line oxc/no-barrel-file -- intentional re-export for engine module API surface.
export { addBlocks } from "./blocks.js";
export { injectSharedConfig, rewriteLocalDependencies } from "./config.js";
export { executePlan } from "./executor.js";
export {
  deriveBinName,
  deriveProjectName,
  isPathWithin,
  resolveAuthor,
  resolvePackageName,
  resolveYear,
  sanitizePackageName,
  validatePackageName,
  validateProjectDirectoryName,
} from "./names.js";
export {
  copyPresetFiles,
  getOutputFilename,
  getPresetsBaseDir,
  isBinaryFile,
  replacePlaceholders,
} from "./preset.js";
export { copyTemplateFiles, getTemplatesDir } from "./template.js";
export type {
  EngineCollector,
  EngineOptions,
  PlaceholderValues,
  ScaffoldChange,
  ScaffoldPlan,
  ScaffoldResult,
} from "./types.js";
export { ScaffoldError } from "./types.js";
export {
  buildWorkspaceRootPackageJson,
  detectWorkspaceRoot,
  scaffoldWorkspaceRoot,
} from "./workspace.js";
