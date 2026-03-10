import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";

import { Result } from "@outfitter/contracts";
import { getPresetsDir } from "@outfitter/presets";
import ts from "typescript";

import type { EngineOptions, PlaceholderValues } from "./types.js";
import { ScaffoldError } from "./types.js";

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".bmp",
  ".tiff",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".wasm",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".sqlite3",
]);

/**
 * Get the directory containing scaffold preset files.
 * Delegates to `@outfitter/presets` which is the single source of truth.
 */
export function getPresetsBaseDir(): string {
  return getPresetsDir();
}

export function getOutputFilename(templateFilename: string): string {
  return templateFilename.endsWith(".template")
    ? templateFilename.slice(0, -".template".length)
    : templateFilename;
}

export function isBinaryFile(filename: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filename).toLowerCase());
}

export function replacePlaceholders(
  content: string,
  values: PlaceholderValues
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.hasOwn(values, key)) {
      return values[key as keyof PlaceholderValues];
    }
    return match;
  });
}

const IMPORT_SORTABLE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

function getScriptKind(filePath: string): ts.ScriptKind {
  switch (extname(filePath).toLowerCase()) {
    case ".js":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function getImportSortKey(
  statement: ts.ImportDeclaration | ts.ImportEqualsDeclaration,
  sourceFile: ts.SourceFile,
  content: string
): string {
  if (ts.isImportDeclaration(statement)) {
    const moduleSpecifier = statement.moduleSpecifier;
    return ts.isStringLiteral(moduleSpecifier)
      ? moduleSpecifier.text
      : moduleSpecifier.getText(sourceFile);
  }

  const reference = statement.moduleReference;
  if (
    ts.isExternalModuleReference(reference) &&
    reference.expression &&
    ts.isStringLiteral(reference.expression)
  ) {
    return reference.expression.text;
  }

  return content.slice(statement.getStart(sourceFile), statement.end);
}

function getImportGroup(sortKey: string): number {
  // Keep runtime-provided modules ahead of package imports to match oxfmt.
  if (sortKey.startsWith("bun:") || sortKey.startsWith("node:")) {
    return 0;
  }

  if (sortKey.startsWith(".") || sortKey.startsWith("/")) {
    return 2;
  }

  return 1;
}

export function sortLeadingImports(filePath: string, content: string): string {
  if (!IMPORT_SORTABLE_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    return content;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );
  const imports: (ts.ImportDeclaration | ts.ImportEqualsDeclaration)[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement)
    ) {
      imports.push(statement);
      continue;
    }

    break;
  }

  if (imports.length < 2) {
    return content;
  }

  const firstImportStart = imports[0]!.getStart(sourceFile);
  const lastImportEnd = imports[imports.length - 1]!.end;
  const sortedImports = [...imports]
    .map((statement, index) => ({
      statement,
      sortKey: getImportSortKey(statement, sourceFile, content),
      textStart: index === 0 ? statement.getStart(sourceFile) : statement.pos,
    }))
    .toSorted((left, right) => {
      const groupDifference =
        getImportGroup(left.sortKey) - getImportGroup(right.sortKey);
      if (groupDifference !== 0) {
        return groupDifference;
      }
      return left.sortKey.localeCompare(right.sortKey);
    });
  let importsBlock = "";

  for (const [index, entry] of sortedImports.entries()) {
    const importText = content
      .slice(entry.textStart, entry.statement.end)
      .trim();
    if (index === 0) {
      importsBlock = importText;
      continue;
    }

    const previous = sortedImports[index - 1];
    const separator =
      previous &&
      getImportGroup(previous.sortKey) !== getImportGroup(entry.sortKey)
        ? "\n\n"
        : "\n";
    importsBlock = `${importsBlock}${separator}${importText}`;
  }

  return `${content.slice(0, firstImportStart)}${importsBlock}${content.slice(lastImportEnd)}`;
}

export function copyPresetFiles(
  presetDir: string,
  targetDir: string,
  values: PlaceholderValues,
  options: EngineOptions,
  copyOptions?: {
    readonly allowOverwrite?: boolean;
    readonly overwritablePaths?: ReadonlySet<string>;
    readonly writtenPaths?: Set<string>;
    readonly skipFilter?: (relativePath: string) => boolean;
    readonly relativePrefix?: string;
  }
): Result<void, ScaffoldError> {
  const allowOverwrite = copyOptions?.allowOverwrite ?? false;
  const relativePrefix = copyOptions?.relativePrefix ?? "";

  try {
    if (!existsSync(targetDir)) {
      if (options.collector) {
        options.collector.add({
          type: "dir-create",
          path: targetDir,
        });
      } else {
        mkdirSync(targetDir, { recursive: true });
      }
    }

    const entries = readdirSync(presetDir);

    for (const entry of entries) {
      const sourcePath = join(presetDir, entry);
      const sourceStat = statSync(sourcePath);
      const relativePath = relativePrefix
        ? `${relativePrefix}/${entry}`
        : entry;

      if (copyOptions?.skipFilter?.(relativePath)) {
        continue;
      }

      if (sourceStat.isDirectory()) {
        const targetSubDir = join(targetDir, entry);
        const nestedResult = copyPresetFiles(
          sourcePath,
          targetSubDir,
          values,
          options,
          {
            ...copyOptions,
            relativePrefix: relativePath,
          }
        );
        if (nestedResult.isErr()) {
          return nestedResult;
        }
        continue;
      }

      if (!sourceStat.isFile()) {
        continue;
      }

      const outputFilename = getOutputFilename(entry);
      const targetPath = join(targetDir, outputFilename);
      const targetExists = existsSync(targetPath);
      const canOverlay =
        allowOverwrite &&
        (!targetExists ||
          !copyOptions?.overwritablePaths ||
          copyOptions.overwritablePaths.has(targetPath));

      if (targetExists && !options.force && !canOverlay) {
        if (options.collector) {
          options.collector.add({
            type: "file-skip",
            path: targetPath,
            reason: "exists",
          });
          continue;
        }
        return Result.err(
          new ScaffoldError(
            `File '${targetPath}' already exists. Use --force to overwrite.`
          )
        );
      }

      if (options.collector) {
        if (targetExists) {
          options.collector.add({
            type: "file-overwrite",
            path: targetPath,
            source: "preset",
          });
        } else {
          options.collector.add({
            type: "file-create",
            path: targetPath,
            source: "preset",
          });
        }
        copyOptions?.writtenPaths?.add(targetPath);
        continue;
      }

      if (isBinaryFile(outputFilename)) {
        const buffer = readFileSync(sourcePath);
        writeFileSync(targetPath, buffer);
        copyOptions?.writtenPaths?.add(targetPath);
        continue;
      }

      const content = readFileSync(sourcePath, "utf-8");
      const processedContent = sortLeadingImports(
        targetPath,
        replacePlaceholders(content, values)
      );
      writeFileSync(targetPath, processedContent, "utf-8");
      copyOptions?.writtenPaths?.add(targetPath);
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to copy preset files: ${message}`)
    );
  }
}
