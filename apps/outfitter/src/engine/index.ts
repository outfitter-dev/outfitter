// biome-ignore lint/performance/noBarrelFile: intentional re-export for engine module API surface.
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
  validateProjectDirectoryName,
} from "./names.js";
export {
  copyTemplateFiles,
  getOutputFilename,
  getTemplatesDir,
  isBinaryFile,
  replacePlaceholders,
} from "./template.js";
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
