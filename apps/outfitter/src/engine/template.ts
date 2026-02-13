import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Result } from "@outfitter/contracts";
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

function hasOutfitterPackage(dir: string): boolean {
  const packageJsonPath = join(dir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as { name?: unknown };
    return parsed.name === "outfitter";
  } catch {
    return false;
  }
}

export function getTemplatesDir(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i++) {
    const templatesPath = join(currentDir, "templates");
    if (existsSync(templatesPath) && hasOutfitterPackage(currentDir)) {
      return templatesPath;
    }
    currentDir = dirname(currentDir);
  }

  const fallback = join(process.cwd(), "apps/outfitter/templates");
  if (existsSync(fallback)) {
    return fallback;
  }

  return join(process.cwd(), "templates");
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

export function copyTemplateFiles(
  templateDir: string,
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

    const entries = readdirSync(templateDir);

    for (const entry of entries) {
      const sourcePath = join(templateDir, entry);
      const sourceStat = statSync(sourcePath);
      const relativePath = relativePrefix
        ? `${relativePrefix}/${entry}`
        : entry;

      if (copyOptions?.skipFilter?.(relativePath)) {
        continue;
      }

      if (sourceStat.isDirectory()) {
        const targetSubDir = join(targetDir, entry);
        const nestedResult = copyTemplateFiles(
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
          Boolean(copyOptions?.overwritablePaths?.has(targetPath)));

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
            source: "template",
          });
        } else {
          options.collector.add({
            type: "file-create",
            path: targetPath,
            source: "template",
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
      const processedContent = replacePlaceholders(content, values);
      writeFileSync(targetPath, processedContent, "utf-8");
      copyOptions?.writtenPaths?.add(targetPath);
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to copy template files: ${message}`)
    );
  }
}
