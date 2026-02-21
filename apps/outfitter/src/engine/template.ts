import {
  copyPresetFiles,
  getOutputFilename as getPresetOutputFilename,
  getPresetsBaseDir,
  isBinaryFile as isPresetBinaryFile,
  replacePlaceholders as replacePresetPlaceholders,
} from "./preset.js";

/**
 * @deprecated Use `getPresetsBaseDir` instead.
 */
export function getTemplatesDir(): string {
  return getPresetsBaseDir();
}

/**
 * @deprecated Use `copyPresetFiles` instead.
 */
export function copyTemplateFiles(
  ...args: Parameters<typeof copyPresetFiles>
): ReturnType<typeof copyPresetFiles> {
  return copyPresetFiles(...args);
}

export function getOutputFilename(templateFilename: string): string {
  return getPresetOutputFilename(templateFilename);
}

export function isBinaryFile(filename: string): boolean {
  return isPresetBinaryFile(filename);
}

export function replacePlaceholders(
  content: string,
  values: Parameters<typeof replacePresetPlaceholders>[1]
): string {
  return replacePresetPlaceholders(content, values);
}
