/**
 * @outfitter/docs-core
 *
 * Core docs assembly and freshness-check primitives.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { Result } from "better-result";
import { collectPackageDocs } from "./package-doc-collection.js";

export type MdxMode = "strict" | "lossy";

export interface PackageDocsOptions {
  readonly excludedFilenames?: readonly string[];
  readonly mdxMode?: MdxMode;
  readonly outputDir?: string;
  readonly packagesDir?: string;
  readonly workspaceRoot?: string;
}

export type LlmsTarget = "llms" | "llms-full";

export interface LlmsDocsOptions extends PackageDocsOptions {
  readonly llmsFile?: string;
  readonly llmsFullFile?: string;
  readonly targets?: readonly LlmsTarget[];
}

export interface SyncPackageDocsResult {
  readonly packageNames: readonly string[];
  readonly removedFiles: readonly string[];
  readonly warnings: readonly DocsWarning[];
  readonly writtenFiles: readonly string[];
}

export type DriftKind = "missing" | "changed" | "unexpected";

export interface DocsDrift {
  readonly kind: DriftKind;
  readonly path: string;
}

export interface DocsWarning {
  readonly message: string;
  readonly path: string;
}

export interface CheckPackageDocsResult {
  readonly drift: readonly DocsDrift[];
  readonly expectedFiles: readonly string[];
  readonly isUpToDate: boolean;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

export interface SyncLlmsDocsResult {
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
  readonly writtenFiles: readonly string[];
}

export interface CheckLlmsDocsResult {
  readonly drift: readonly DocsDrift[];
  readonly expectedFiles: readonly string[];
  readonly isUpToDate: boolean;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

export class DocsCoreError extends Error {
  readonly _tag = "DocsCoreError" as const;
  readonly category: "validation" | "internal";
  readonly context: Record<string, unknown> | undefined;

  constructor(input: {
    message: string;
    category: "validation" | "internal";
    context?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "DocsCoreError";
    this.category = input.category;
    this.context = input.context;
  }

  static validation(
    message: string,
    context?: Record<string, unknown>
  ): DocsCoreError {
    return new DocsCoreError({
      message,
      category: "validation",
      ...(context ? { context } : {}),
    });
  }

  static internal(
    message: string,
    context?: Record<string, unknown>
  ): DocsCoreError {
    return new DocsCoreError({
      message,
      category: "internal",
      ...(context ? { context } : {}),
    });
  }
}

export type PackageDocsError = DocsCoreError;

interface ResolvedPackageDocsOptions {
  readonly excludedLowercaseNames: ReadonlySet<string>;
  readonly mdxMode: MdxMode;
  readonly outputRoot: string;
  readonly packagesRoot: string;
  readonly workspaceRoot: string;
}

interface ExpectedOutput {
  readonly entries: readonly ExpectedOutputEntry[];
  readonly files: ReadonlyMap<string, string>;
  readonly packageNames: readonly string[];
  readonly warnings: readonly DocsWarning[];
}

interface ExpectedOutputEntry {
  readonly content: string;
  readonly destinationAbsolutePath: string;
  readonly packageName: string;
}

interface CollectedMarkdownFile {
  readonly destinationAbsolutePath: string;
  readonly packageName: string;
  readonly sourceAbsolutePath: string;
}

interface ResolvedLlmsOptions {
  readonly llmsFullPath: string;
  readonly llmsPath: string;
  readonly targets: readonly LlmsTarget[];
}

const DEFAULT_PACKAGES_DIR = "packages";
const DEFAULT_OUTPUT_DIR = "docs/packages";
const DEFAULT_EXCLUDED_FILES = ["CHANGELOG.md"] as const;
const DEFAULT_LLMS_FILE = "docs/llms.txt";
const DEFAULT_LLMS_FULL_FILE = "docs/llms-full.txt";
const DEFAULT_LLMS_TARGETS = ["llms", "llms-full"] as const;
const DEFAULT_MDX_MODE: MdxMode = "lossy";

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function relativeToWorkspace(
  workspaceRoot: string,
  absolutePath: string
): string {
  return toPosixPath(relative(workspaceRoot, absolutePath));
}

function isPathInsideWorkspace(
  workspaceRoot: string,
  absolutePath: string
): boolean {
  const rel = relative(workspaceRoot, absolutePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

function isSamePathOrDescendant(
  parentPath: string,
  candidatePath: string
): boolean {
  const rel = relative(parentPath, candidatePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

function pathsOverlap(pathA: string, pathB: string): boolean {
  return (
    isSamePathOrDescendant(pathA, pathB) || isSamePathOrDescendant(pathB, pathA)
  );
}

function normalizeExcludedNames(
  names: readonly string[] | undefined
): ReadonlySet<string> {
  return new Set(
    (names ?? DEFAULT_EXCLUDED_FILES).map((name) => name.toLowerCase())
  );
}

function isMdxMode(value: string): value is MdxMode {
  return value === "strict" || value === "lossy";
}

function resolveOptions(
  options: PackageDocsOptions | undefined
): Result<ResolvedPackageDocsOptions, PackageDocsError> {
  const workspaceRoot = resolve(options?.workspaceRoot ?? process.cwd());
  const packagesRoot = resolve(
    workspaceRoot,
    options?.packagesDir ?? DEFAULT_PACKAGES_DIR
  );
  const outputRoot = resolve(
    workspaceRoot,
    options?.outputDir ?? DEFAULT_OUTPUT_DIR
  );
  const excludedLowercaseNames = normalizeExcludedNames(
    options?.excludedFilenames
  );
  const mdxMode = options?.mdxMode ?? DEFAULT_MDX_MODE;

  if (!isMdxMode(mdxMode)) {
    return Result.err(
      DocsCoreError.validation("Invalid MDX mode", {
        mdxMode,
      })
    );
  }

  if (!existsSync(workspaceRoot)) {
    return Result.err(
      DocsCoreError.validation("workspaceRoot does not exist", {
        workspaceRoot,
      })
    );
  }

  if (!existsSync(packagesRoot)) {
    return Result.err(
      DocsCoreError.validation("packages directory does not exist", {
        packagesRoot,
      })
    );
  }

  if (!isPathInsideWorkspace(workspaceRoot, outputRoot)) {
    return Result.err(
      DocsCoreError.validation("outputDir must resolve inside workspace", {
        outputRoot,
      })
    );
  }

  if (pathsOverlap(outputRoot, packagesRoot)) {
    return Result.err(
      DocsCoreError.validation(
        "outputDir must not overlap packages directory",
        {
          outputRoot,
          packagesRoot,
        }
      )
    );
  }

  return Result.ok({
    workspaceRoot,
    packagesRoot,
    outputRoot,
    excludedLowercaseNames,
    mdxMode,
  });
}

function isLlmsTarget(value: string): value is LlmsTarget {
  return value === "llms" || value === "llms-full";
}

function resolveLlmsOptions(
  workspaceRoot: string,
  options: LlmsDocsOptions | undefined
): Result<ResolvedLlmsOptions, PackageDocsError> {
  const llmsPath = resolve(
    workspaceRoot,
    options?.llmsFile ?? DEFAULT_LLMS_FILE
  );
  const llmsFullPath = resolve(
    workspaceRoot,
    options?.llmsFullFile ?? DEFAULT_LLMS_FULL_FILE
  );
  const rawTargets = options?.targets ?? DEFAULT_LLMS_TARGETS;
  const targets = [...new Set(rawTargets)];

  for (const target of targets) {
    if (!isLlmsTarget(target)) {
      return Result.err(
        DocsCoreError.validation("Invalid LLM export target", {
          target,
        })
      );
    }
  }

  if (!isPathInsideWorkspace(workspaceRoot, llmsPath)) {
    return Result.err(
      DocsCoreError.validation("llmsFile must resolve inside workspace", {
        llmsPath,
      })
    );
  }

  if (!isPathInsideWorkspace(workspaceRoot, llmsFullPath)) {
    return Result.err(
      DocsCoreError.validation("llmsFullFile must resolve inside workspace", {
        llmsFullPath,
      })
    );
  }

  if (llmsPath === llmsFullPath) {
    return Result.err(
      DocsCoreError.validation(
        "llmsFile and llmsFullFile must resolve to distinct paths",
        {
          llmsPath,
          llmsFullPath,
        }
      )
    );
  }

  return Result.ok({
    llmsPath,
    llmsFullPath,
    targets,
  });
}

function splitMarkdownTarget(target: string): {
  pathPart: string;
  suffix: string;
  wrappedInAngles: boolean;
} {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    return { pathPart: target, suffix: "", wrappedInAngles: false };
  }

  // Keep optional title suffix untouched: "path \"title\"" or "path 'title'".
  const splitAt = trimmed.search(/\s/);
  const firstToken = splitAt >= 0 ? trimmed.slice(0, splitAt) : trimmed;
  const suffix = splitAt >= 0 ? trimmed.slice(splitAt) : "";

  const wrappedInAngles =
    firstToken.startsWith("<") &&
    firstToken.endsWith(">") &&
    firstToken.length > 2;
  const pathPart = wrappedInAngles ? firstToken.slice(1, -1) : firstToken;

  return { pathPart, suffix, wrappedInAngles };
}

function isRewritableRelativeTarget(pathPart: string): boolean {
  return !(
    pathPart.length === 0 ||
    pathPart.startsWith("#") ||
    pathPart.startsWith("/") ||
    pathPart.startsWith("http://") ||
    pathPart.startsWith("https://") ||
    pathPart.startsWith("mailto:") ||
    pathPart.startsWith("tel:") ||
    pathPart.startsWith("data:") ||
    pathPart.startsWith("//")
  );
}

function splitPathQueryAndHash(pathPart: string): {
  pathname: string;
  query: string;
  hash: string;
} {
  const hashIndex = pathPart.indexOf("#");
  const withNoHash = hashIndex >= 0 ? pathPart.slice(0, hashIndex) : pathPart;
  const hash = hashIndex >= 0 ? pathPart.slice(hashIndex) : "";

  const queryIndex = withNoHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? withNoHash.slice(0, queryIndex) : withNoHash;
  const query = queryIndex >= 0 ? withNoHash.slice(queryIndex) : "";

  return { pathname, query, hash };
}

function rewriteMarkdownLinkTarget(
  target: string,
  sourceAbsolutePath: string,
  destinationAbsolutePath: string,
  workspaceRoot: string,
  mirrorTargetBySourcePath: ReadonlyMap<string, string>
): string {
  const { pathPart, suffix, wrappedInAngles } = splitMarkdownTarget(target);
  if (!isRewritableRelativeTarget(pathPart)) {
    return target;
  }

  const { pathname, query, hash } = splitPathQueryAndHash(pathPart);
  if (pathname.length === 0) {
    return target;
  }

  const absoluteTarget = resolve(dirname(sourceAbsolutePath), pathname);
  if (!isPathInsideWorkspace(workspaceRoot, absoluteTarget)) {
    return target;
  }

  const rewrittenAbsoluteTarget =
    mirrorTargetBySourcePath.get(absoluteTarget) ?? absoluteTarget;

  let rewrittenPath = toPosixPath(
    relative(dirname(destinationAbsolutePath), rewrittenAbsoluteTarget)
  );

  if (rewrittenPath.length === 0) {
    rewrittenPath = "./";
  } else if (!rewrittenPath.startsWith(".")) {
    rewrittenPath = `./${rewrittenPath}`;
  }

  const rewritten = `${rewrittenPath}${query}${hash}`;
  const maybeWrapped = wrappedInAngles ? `<${rewritten}>` : rewritten;
  return `${maybeWrapped}${suffix}`;
}

function rewriteMarkdownLinks(
  markdown: string,
  sourceAbsolutePath: string,
  destinationAbsolutePath: string,
  workspaceRoot: string,
  mirrorTargetBySourcePath: ReadonlyMap<string, string>
): string {
  return markdown.replace(
    /(!?\[[^\]]*]\()([^)]+)(\))/g,
    (_match, prefix: string, target: string, suffix: string) =>
      `${prefix}${rewriteMarkdownLinkTarget(
        target,
        sourceAbsolutePath,
        destinationAbsolutePath,
        workspaceRoot,
        mirrorTargetBySourcePath
      )}${suffix}`
  );
}

function getCodeFenceDelimiter(line: string): string | null {
  const fenceMatch = /^\s*(```+|~~~+)/u.exec(line);
  return fenceMatch?.at(1) ?? null;
}

function strictMdxError(input: {
  workspaceRoot: string;
  sourceAbsolutePath: string;
  lineNumber: number;
  syntax: string;
}): PackageDocsError {
  return DocsCoreError.validation(
    `Unsupported MDX syntax in strict mode: ${input.syntax}`,
    {
      line: input.lineNumber,
      path: relativeToWorkspace(input.workspaceRoot, input.sourceAbsolutePath),
      syntax: input.syntax,
    }
  );
}

function processDocsSourceContent(input: {
  content: string;
  sourceAbsolutePath: string;
  workspaceRoot: string;
  mdxMode: MdxMode;
}): Result<
  { content: string; warnings: readonly DocsWarning[] },
  PackageDocsError
> {
  if (extname(input.sourceAbsolutePath).toLowerCase() !== ".mdx") {
    return Result.ok({ content: input.content, warnings: [] });
  }

  const warningPath = relativeToWorkspace(
    input.workspaceRoot,
    input.sourceAbsolutePath
  );
  const outputLines: string[] = [];
  const warnings: DocsWarning[] = [];
  const sourceLines = input.content.split(/\r?\n/u);
  let activeFenceDelimiter: string | null = null;

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? "";
    const lineNumber = index + 1;
    const fenceDelimiter = getCodeFenceDelimiter(line);

    if (activeFenceDelimiter) {
      outputLines.push(line);
      if (
        fenceDelimiter &&
        fenceDelimiter[0] === activeFenceDelimiter[0] &&
        fenceDelimiter.length >= activeFenceDelimiter.length
      ) {
        activeFenceDelimiter = null;
      }
      continue;
    }

    if (fenceDelimiter) {
      activeFenceDelimiter = fenceDelimiter;
      outputLines.push(line);
      continue;
    }

    if (/^\s*(import|export)\s/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "import/export statement",
          })
        );
      }

      warnings.push({
        message: `Removed import/export statement on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/^\s*<\/?[A-Z][\w.]*\b[^>]*>\s*$/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "JSX component tag",
          })
        );
      }

      warnings.push({
        message: `Removed JSX component tag on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/^\s*\{.*\}\s*$/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "expression block",
          })
        );
      }

      warnings.push({
        message: `Removed expression block on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/\{[^{}]+\}/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "inline expression",
          })
        );
      }

      warnings.push({
        message: `Removed inline expression on line ${lineNumber}`,
        path: warningPath,
      });

      outputLines.push(
        line.replace(/\{[^{}]+\}/gu, "").replace(/[ \t]+$/u, "")
      );
      continue;
    }

    outputLines.push(line);
  }

  return Result.ok({
    content: outputLines.join("\n"),
    warnings,
  });
}

async function buildExpectedOutput(
  options: ResolvedPackageDocsOptions
): Promise<ExpectedOutput> {
  const collectedDocsResult = await collectPackageDocs({
    workspaceRoot: options.workspaceRoot,
    packagesRoot: options.packagesRoot,
    outputRoot: options.outputRoot,
    excludedLowercaseNames: options.excludedLowercaseNames,
  });
  if (collectedDocsResult.isErr()) {
    const error = collectedDocsResult.error;
    if (error.kind === "outputPathOutsideWorkspace") {
      throw DocsCoreError.validation(
        "outputPath must resolve inside workspace",
        {
          sourcePath: error.sourcePath,
          outputAbsPath: error.outputAbsolutePath,
        }
      );
    }

    throw DocsCoreError.validation(
      "Multiple source docs files resolve to the same output path",
      {
        outputPath: error.outputPath,
        firstSourcePath: error.collisionSourcePath,
        secondSourcePath: error.sourcePath,
      }
    );
  }

  const collectedFiles: CollectedMarkdownFile[] =
    collectedDocsResult.value.files.map((file) => ({
      packageName: file.packageName,
      sourceAbsolutePath: file.sourceAbsolutePath,
      destinationAbsolutePath: file.destinationAbsolutePath,
    }));
  const files = new Map<string, string>();
  const warnings: DocsWarning[] = [];

  const mirrorTargetBySourcePath = new Map<string, string>(
    collectedFiles.map((file) => [
      file.sourceAbsolutePath,
      file.destinationAbsolutePath,
    ])
  );

  const sortedCollectedFiles = [...collectedFiles].sort((a, b) =>
    toPosixPath(a.destinationAbsolutePath).localeCompare(
      toPosixPath(b.destinationAbsolutePath)
    )
  );
  const entries: ExpectedOutputEntry[] = [];

  for (const collectedFile of sortedCollectedFiles) {
    const sourceContent = await readFile(
      collectedFile.sourceAbsolutePath,
      "utf8"
    );
    const processedContentResult = processDocsSourceContent({
      content: sourceContent,
      sourceAbsolutePath: collectedFile.sourceAbsolutePath,
      workspaceRoot: options.workspaceRoot,
      mdxMode: options.mdxMode,
    });
    if (processedContentResult.isErr()) {
      throw processedContentResult.error;
    }

    const rewrittenContent = rewriteMarkdownLinks(
      processedContentResult.value.content,
      collectedFile.sourceAbsolutePath,
      collectedFile.destinationAbsolutePath,
      options.workspaceRoot,
      mirrorTargetBySourcePath
    );

    warnings.push(...processedContentResult.value.warnings);

    files.set(collectedFile.destinationAbsolutePath, rewrittenContent);
    entries.push({
      packageName: collectedFile.packageName,
      destinationAbsolutePath: collectedFile.destinationAbsolutePath,
      content: rewrittenContent,
    });
  }

  return {
    packageNames: collectedDocsResult.value.packageNames,
    files,
    entries,
    warnings,
  };
}

function trimTrailingWhitespace(value: string): string {
  return value.replace(/[ \t]+$/gm, "").trimEnd();
}

function extractFirstHeading(content: string): string | null {
  for (const line of content.split(/\r?\n/u)) {
    const headingMatch = /^\s*#{1,6}\s+(.+)$/u.exec(line);
    if (!headingMatch) {
      continue;
    }

    const heading = headingMatch.at(1);
    if (heading) {
      return heading.trim();
    }
  }

  return null;
}

function renderLlmsIndex(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string
): string {
  const lines: string[] = [
    "# llms.txt",
    "",
    "Outfitter package docs index for LLM retrieval.",
    "",
  ];

  for (const packageName of expectedOutput.packageNames) {
    lines.push(`## ${packageName}`);

    const packageEntries = expectedOutput.entries
      .filter((entry) => entry.packageName === packageName)
      .sort((a, b) =>
        toPosixPath(a.destinationAbsolutePath).localeCompare(
          toPosixPath(b.destinationAbsolutePath)
        )
      );

    for (const entry of packageEntries) {
      const relativePath = relativeToWorkspace(
        workspaceRoot,
        entry.destinationAbsolutePath
      );
      const heading = extractFirstHeading(entry.content);
      lines.push(`- ${relativePath}${heading ? ` — ${heading}` : ""}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderLlmsFull(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string
): string {
  const lines: string[] = [
    "# llms-full.txt",
    "",
    "Outfitter package docs corpus for LLM retrieval.",
    "",
  ];

  const entries = [...expectedOutput.entries].sort((a, b) =>
    toPosixPath(a.destinationAbsolutePath).localeCompare(
      toPosixPath(b.destinationAbsolutePath)
    )
  );

  for (const entry of entries) {
    const relativePath = relativeToWorkspace(
      workspaceRoot,
      entry.destinationAbsolutePath
    );
    const heading = extractFirstHeading(entry.content);

    lines.push("---");
    lines.push(`path: ${relativePath}`);
    lines.push(`package: ${entry.packageName}`);
    if (heading) {
      lines.push(`title: ${heading}`);
    }
    lines.push("---");
    lines.push("");
    lines.push(trimTrailingWhitespace(entry.content));
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function buildLlmsExpectedFiles(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string,
  llmsOptions: ResolvedLlmsOptions
): Map<string, string> {
  const files = new Map<string, string>();

  for (const target of llmsOptions.targets) {
    if (target === "llms") {
      files.set(
        llmsOptions.llmsPath,
        renderLlmsIndex(expectedOutput, workspaceRoot)
      );
      continue;
    }

    files.set(
      llmsOptions.llmsFullPath,
      renderLlmsFull(expectedOutput, workspaceRoot)
    );
  }

  return files;
}

async function computeExplicitFileDrift(
  workspaceRoot: string,
  expectedFiles: ReadonlyMap<string, string>
): Promise<DocsDrift[]> {
  const drift: DocsDrift[] = [];
  const expectedEntries = [...expectedFiles.entries()].sort(([a], [b]) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );

  for (const [expectedPath, expectedContent] of expectedEntries) {
    if (!existsSync(expectedPath)) {
      drift.push({
        kind: "missing",
        path: relativeToWorkspace(workspaceRoot, expectedPath),
      });
      continue;
    }

    const existingContent = await readFile(expectedPath, "utf8");
    if (existingContent !== expectedContent) {
      drift.push({
        kind: "changed",
        path: relativeToWorkspace(workspaceRoot, expectedPath),
      });
    }
  }

  return sortDrift(drift);
}

async function listFilesRecursively(rootPath: string): Promise<string[]> {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files: string[] = [];
  const directories = [rootPath];

  while (directories.length > 0) {
    const currentDir = directories.pop();
    if (!currentDir) {
      continue;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        directories.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

async function pruneEmptyDirectories(rootPath: string): Promise<void> {
  if (!existsSync(rootPath)) {
    return;
  }

  async function prune(currentDir: string): Promise<boolean> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    let hasFiles = false;

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const childHasFiles = await prune(fullPath);
        if (childHasFiles) {
          hasFiles = true;
        } else {
          await rm(fullPath, { recursive: true, force: true });
        }
      } else {
        hasFiles = true;
      }
    }

    return hasFiles;
  }

  await prune(rootPath);
}

function sortDrift(drift: DocsDrift[]): DocsDrift[] {
  const kindPriority: Record<DriftKind, number> = {
    changed: 0,
    missing: 1,
    unexpected: 2,
  };

  return drift.sort((a, b) => {
    const byKind = kindPriority[a.kind] - kindPriority[b.kind];
    if (byKind !== 0) {
      return byKind;
    }

    return a.path.localeCompare(b.path);
  });
}

async function computeDrift(
  options: ResolvedPackageDocsOptions,
  expectedFiles: ReadonlyMap<string, string>
): Promise<DocsDrift[]> {
  const expectedPaths = new Set(expectedFiles.keys());
  const existingFiles = await listFilesRecursively(options.outputRoot);
  const drift: DocsDrift[] = [];

  const expectedEntries = [...expectedFiles.entries()].sort(([a], [b]) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );

  for (const [expectedPath, expectedContent] of expectedEntries) {
    if (!existsSync(expectedPath)) {
      drift.push({
        kind: "missing",
        path: relativeToWorkspace(options.workspaceRoot, expectedPath),
      });
      continue;
    }

    const existingContent = await readFile(expectedPath, "utf8");
    if (existingContent !== expectedContent) {
      drift.push({
        kind: "changed",
        path: relativeToWorkspace(options.workspaceRoot, expectedPath),
      });
    }
  }

  for (const existingPath of existingFiles) {
    if (expectedPaths.has(existingPath)) {
      continue;
    }

    drift.push({
      kind: "unexpected",
      path: relativeToWorkspace(options.workspaceRoot, existingPath),
    });
  }

  return sortDrift(drift);
}

export async function syncPackageDocs(
  options?: PackageDocsOptions
): Promise<Result<SyncPackageDocsResult, PackageDocsError>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const existingFiles = await listFilesRecursively(
      resolvedOptions.outputRoot
    );
    const expectedPaths = new Set(expectedOutput.files.keys());
    const unexpectedFiles = existingFiles.filter(
      (existingPath) => !expectedPaths.has(existingPath)
    );

    for (const filePath of unexpectedFiles) {
      await rm(filePath, { force: true });
    }

    for (const [outputPath, content] of expectedOutput.files.entries()) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }

    await pruneEmptyDirectories(resolvedOptions.outputRoot);

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      writtenFiles: [...expectedOutput.files.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      removedFiles: unexpectedFiles
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreError) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreError.internal("Failed to sync package docs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function checkPackageDocs(
  options?: PackageDocsOptions
): Promise<Result<CheckPackageDocsResult, PackageDocsError>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const drift = await computeDrift(resolvedOptions, expectedOutput.files);

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      expectedFiles: [...expectedOutput.files.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      drift,
      isUpToDate: drift.length === 0,
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreError) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreError.internal("Failed to check package docs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function syncLlmsDocs(
  options?: LlmsDocsOptions
): Promise<Result<SyncLlmsDocsResult, PackageDocsError>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;
  const resolvedLlmsOptionsResult = resolveLlmsOptions(
    resolvedOptions.workspaceRoot,
    options
  );
  if (resolvedLlmsOptionsResult.isErr()) {
    return resolvedLlmsOptionsResult;
  }

  const resolvedLlmsOptions = resolvedLlmsOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const expectedFiles = buildLlmsExpectedFiles(
      expectedOutput,
      resolvedOptions.workspaceRoot,
      resolvedLlmsOptions
    );

    for (const [outputPath, content] of expectedFiles.entries()) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, "utf8");
    }

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      writtenFiles: [...expectedFiles.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreError) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreError.internal("Failed to sync LLM docs outputs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export async function checkLlmsDocs(
  options?: LlmsDocsOptions
): Promise<Result<CheckLlmsDocsResult, PackageDocsError>> {
  const resolvedOptionsResult = resolveOptions(options);
  if (resolvedOptionsResult.isErr()) {
    return resolvedOptionsResult;
  }

  const resolvedOptions = resolvedOptionsResult.value;
  const resolvedLlmsOptionsResult = resolveLlmsOptions(
    resolvedOptions.workspaceRoot,
    options
  );
  if (resolvedLlmsOptionsResult.isErr()) {
    return resolvedLlmsOptionsResult;
  }

  const resolvedLlmsOptions = resolvedLlmsOptionsResult.value;

  try {
    const expectedOutput = await buildExpectedOutput(resolvedOptions);
    const expectedFiles = buildLlmsExpectedFiles(
      expectedOutput,
      resolvedOptions.workspaceRoot,
      resolvedLlmsOptions
    );
    const drift = await computeExplicitFileDrift(
      resolvedOptions.workspaceRoot,
      expectedFiles
    );

    return Result.ok({
      packageNames: expectedOutput.packageNames,
      expectedFiles: [...expectedFiles.keys()]
        .map((filePath) =>
          relativeToWorkspace(resolvedOptions.workspaceRoot, filePath)
        )
        .sort((a, b) => a.localeCompare(b)),
      drift,
      isUpToDate: drift.length === 0,
      warnings: expectedOutput.warnings,
    });
  } catch (error) {
    if (error instanceof DocsCoreError) {
      return Result.err(error);
    }

    return Result.err(
      DocsCoreError.internal("Failed to check LLM docs outputs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}
