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

export interface PackageDocsOptions {
  readonly workspaceRoot?: string;
  readonly packagesDir?: string;
  readonly outputDir?: string;
  readonly excludedFilenames?: readonly string[];
}

export type LlmsTarget = "llms" | "llms-full";

export interface LlmsDocsOptions extends PackageDocsOptions {
  readonly llmsFile?: string;
  readonly llmsFullFile?: string;
  readonly targets?: readonly LlmsTarget[];
}

export interface SyncPackageDocsResult {
  readonly packageNames: readonly string[];
  readonly writtenFiles: readonly string[];
  readonly removedFiles: readonly string[];
}

export type DriftKind = "missing" | "changed" | "unexpected";

export interface DocsDrift {
  readonly path: string;
  readonly kind: DriftKind;
}

export interface CheckPackageDocsResult {
  readonly packageNames: readonly string[];
  readonly expectedFiles: readonly string[];
  readonly drift: readonly DocsDrift[];
  readonly isUpToDate: boolean;
}

export interface SyncLlmsDocsResult {
  readonly packageNames: readonly string[];
  readonly writtenFiles: readonly string[];
}

export interface CheckLlmsDocsResult {
  readonly packageNames: readonly string[];
  readonly expectedFiles: readonly string[];
  readonly drift: readonly DocsDrift[];
  readonly isUpToDate: boolean;
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
  readonly workspaceRoot: string;
  readonly packagesRoot: string;
  readonly outputRoot: string;
  readonly excludedLowercaseNames: ReadonlySet<string>;
}

interface DiscoveredPackage {
  readonly packageDirName: string;
  readonly packageRoot: string;
}

interface ExpectedOutput {
  readonly packageNames: readonly string[];
  readonly files: ReadonlyMap<string, string>;
  readonly entries: readonly ExpectedOutputEntry[];
}

interface ExpectedOutputEntry {
  readonly packageName: string;
  readonly destinationAbsolutePath: string;
  readonly content: string;
}

interface CollectedMarkdownFile {
  readonly packageName: string;
  readonly sourceAbsolutePath: string;
  readonly destinationAbsolutePath: string;
}

interface ResolvedLlmsOptions {
  readonly llmsPath: string;
  readonly llmsFullPath: string;
  readonly targets: readonly LlmsTarget[];
}

const DEFAULT_PACKAGES_DIR = "packages";
const DEFAULT_OUTPUT_DIR = "docs/packages";
const DEFAULT_EXCLUDED_FILES = ["CHANGELOG.md"] as const;
const DEFAULT_LLMS_FILE = "docs/llms.txt";
const DEFAULT_LLMS_FULL_FILE = "docs/llms-full.txt";
const DEFAULT_LLMS_TARGETS = ["llms", "llms-full"] as const;

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

async function discoverPackageDirectories(
  packagesRoot: string
): Promise<DiscoveredPackage[]> {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      packageDirName: entry.name,
      packageRoot: join(packagesRoot, entry.name),
    }))
    .sort((a, b) => a.packageDirName.localeCompare(b.packageDirName));
}

async function isPublishablePackage(packageRoot: string): Promise<boolean> {
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(content) as { private?: boolean };
    return parsed.private !== true;
  } catch {
    return false;
  }
}

function isMarkdownFile(path: string): boolean {
  return extname(path).toLowerCase() === ".md";
}

function isExcludedFileName(
  path: string,
  excludedLowercaseNames: ReadonlySet<string>
): boolean {
  const fileName = path.split(/[\\/]/).at(-1) ?? "";
  return excludedLowercaseNames.has(fileName.toLowerCase());
}

async function collectDocsSubtreeMarkdownFiles(
  docsRoot: string,
  excludedLowercaseNames: ReadonlySet<string>
): Promise<string[]> {
  if (!existsSync(docsRoot)) {
    return [];
  }

  const files: string[] = [];
  const directories = [docsRoot];

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
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isMarkdownFile(entry.name)) {
        continue;
      }

      if (isExcludedFileName(entry.name, excludedLowercaseNames)) {
        continue;
      }

      files.push(fullPath);
    }
  }

  return files.sort((a, b) => toPosixPath(a).localeCompare(toPosixPath(b)));
}

async function collectPackageMarkdownFiles(
  packageRoot: string,
  excludedLowercaseNames: ReadonlySet<string>
): Promise<string[]> {
  const rootEntries = await readdir(packageRoot, { withFileTypes: true });

  const rootMarkdown = rootEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((entryName) => isMarkdownFile(entryName))
    .filter(
      (entryName) => !isExcludedFileName(entryName, excludedLowercaseNames)
    )
    .map((entryName) => join(packageRoot, entryName));

  const docsSubtreeMarkdown = await collectDocsSubtreeMarkdownFiles(
    join(packageRoot, "docs"),
    excludedLowercaseNames
  );

  return [...rootMarkdown, ...docsSubtreeMarkdown].sort((a, b) =>
    toPosixPath(a).localeCompare(toPosixPath(b))
  );
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

async function buildExpectedOutput(
  options: ResolvedPackageDocsOptions
): Promise<ExpectedOutput> {
  const discoveredPackages = await discoverPackageDirectories(
    options.packagesRoot
  );
  const packageNames: string[] = [];
  const collectedFiles: CollectedMarkdownFile[] = [];
  const files = new Map<string, string>();

  for (const discoveredPackage of discoveredPackages) {
    const publishable = await isPublishablePackage(
      discoveredPackage.packageRoot
    );
    if (!publishable) {
      continue;
    }

    const markdownFiles = await collectPackageMarkdownFiles(
      discoveredPackage.packageRoot,
      options.excludedLowercaseNames
    );
    if (markdownFiles.length === 0) {
      continue;
    }

    packageNames.push(discoveredPackage.packageDirName);

    for (const sourceAbsolutePath of markdownFiles) {
      const relativeFromPackageRoot = relative(
        discoveredPackage.packageRoot,
        sourceAbsolutePath
      );
      const destinationAbsolutePath = join(
        options.outputRoot,
        discoveredPackage.packageDirName,
        relativeFromPackageRoot
      );
      collectedFiles.push({
        packageName: discoveredPackage.packageDirName,
        sourceAbsolutePath,
        destinationAbsolutePath,
      });
    }
  }

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
    const rewrittenContent = rewriteMarkdownLinks(
      sourceContent,
      collectedFile.sourceAbsolutePath,
      collectedFile.destinationAbsolutePath,
      options.workspaceRoot,
      mirrorTargetBySourcePath
    );

    files.set(collectedFile.destinationAbsolutePath, rewrittenContent);
    entries.push({
      packageName: collectedFile.packageName,
      destinationAbsolutePath: collectedFile.destinationAbsolutePath,
      content: rewrittenContent,
    });
  }

  return {
    packageNames: packageNames.sort((a, b) => a.localeCompare(b)),
    files,
    entries,
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
    });
  } catch (error) {
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
    });
  } catch (error) {
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
    });
  } catch (error) {
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
    });
  } catch (error) {
    return Result.err(
      DocsCoreError.internal("Failed to check LLM docs outputs", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}
