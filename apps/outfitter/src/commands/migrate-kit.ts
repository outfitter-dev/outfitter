/**
 * `outfitter migrate kit` - codemod for kit-first foundation adoption.
 *
 * Rewrites foundation imports from `@outfitter/contracts` and `@outfitter/types`
 * to `@outfitter/kit/foundation/*` and updates package manifests to depend on
 * `@outfitter/kit`.
 *
 * @packageDocumentation
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { Command } from "commander";
import ts from "typescript";
import { resolveStructuredOutputMode } from "../output-mode.js";

const FOUNDATION_IMPORT_MAP = {
  "@outfitter/contracts": "@outfitter/kit/foundation/contracts",
  "@outfitter/types": "@outfitter/kit/foundation/types",
} as const;

const FOUNDATION_PACKAGES = [
  "@outfitter/contracts",
  "@outfitter/types",
] as const;
type FoundationPackage = (typeof FOUNDATION_PACKAGES)[number];

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

interface ManifestRecord {
  workspaces?: unknown;
  [key: string]: unknown;
}

interface DiffPreview {
  readonly path: string;
  readonly preview: string;
}

interface ChangeSet {
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

/**
 * Options for the migrate-kit command.
 */
export interface MigrateKitOptions {
  /** Target directory to migrate (defaults to cwd). */
  readonly targetDir?: string | undefined;
  /** Run codemod without writing changes to disk. */
  readonly dryRun?: boolean | undefined;
}

/**
 * Result from migrate-kit execution.
 */
export interface MigrateKitResult {
  readonly targetDir: string;
  readonly dryRun: boolean;
  readonly packageJsonFiles: number;
  readonly sourceFiles: number;
  readonly manifestUpdates: number;
  readonly importRewrites: number;
  readonly changedFiles: readonly string[];
  readonly diffs: readonly DiffPreview[];
}

/**
 * Error returned when migration fails.
 */
export class MigrateKitError extends Error {
  readonly _tag = "MigrateKitError" as const;

  constructor(message: string) {
    super(message);
    this.name = "MigrateKitError";
  }
}

interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function parseManifest(
  filePath: string
): Result<ManifestRecord, MigrateKitError> {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Result.err(
        new MigrateKitError(`Invalid package.json at ${filePath}`)
      );
    }
    return Result.ok(parsed as ManifestRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new MigrateKitError(
        `Failed to read package.json at ${filePath}: ${message}`
      )
    );
  }
}

function resolveWorkspacePatterns(manifest: ManifestRecord): string[] {
  const workspaces = manifest["workspaces"];
  if (Array.isArray(workspaces)) {
    return workspaces.filter(
      (value): value is string => typeof value === "string"
    );
  }

  if (
    !workspaces ||
    typeof workspaces !== "object" ||
    Array.isArray(workspaces)
  ) {
    return [];
  }

  const packages = (workspaces as { packages?: unknown }).packages;
  if (!Array.isArray(packages)) {
    return [];
  }

  return packages.filter((value): value is string => typeof value === "string");
}

function normalizeWorkspacePattern(pattern: string): string {
  let value = pattern.trim().replaceAll("\\", "/");
  if (value.length === 0) return value;
  if (value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  if (value.endsWith("package.json")) {
    return value;
  }
  return `${value}/package.json`;
}

function collectPackageJsonFiles(
  rootDir: string
): Result<string[], MigrateKitError> {
  const rootPackageJson = join(rootDir, "package.json");
  if (!existsSync(rootPackageJson)) {
    return Result.err(
      new MigrateKitError(`No package.json found at ${rootPackageJson}`)
    );
  }

  const manifestResult = parseManifest(rootPackageJson);
  if (manifestResult.isErr()) {
    return manifestResult;
  }

  const workspacePatterns = resolveWorkspacePatterns(manifestResult.value);
  const files = new Set<string>([rootPackageJson]);

  for (const pattern of workspacePatterns) {
    const normalized = normalizeWorkspacePattern(pattern);
    if (normalized.length === 0) {
      continue;
    }

    const glob = new Bun.Glob(normalized);
    for (const entry of glob.scanSync({ cwd: rootDir })) {
      const absolute = resolve(rootDir, entry);
      if (existsSync(absolute) && basename(absolute) === "package.json") {
        files.add(absolute);
      }
    }
  }

  return Result.ok(Array.from(files).sort((a, b) => a.localeCompare(b)));
}

function isSourceFile(filename: string): boolean {
  for (const extension of SOURCE_EXTENSIONS) {
    if (filename.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

function collectSourceFiles(
  packageDir: string
): Result<string[], MigrateKitError> {
  const files: string[] = [];
  const stack = [packageDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    let entries: string[];
    try {
      entries = readdirSync(currentDir).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return Result.err(
        new MigrateKitError(
          `Failed to read source directory ${currentDir}: ${message}`
        )
      );
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(fullPath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return Result.err(
          new MigrateKitError(
            `Failed to read source tree entry ${fullPath}: ${message}`
          )
        );
      }

      if (stat.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry)) {
          continue;
        }

        // Treat nested package.json as a package boundary to avoid duplicate traversal.
        if (existsSync(join(fullPath, "package.json"))) {
          continue;
        }

        stack.push(fullPath);
        continue;
      }

      if (!stat.isFile()) {
        continue;
      }

      if (!isSourceFile(entry)) {
        continue;
      }

      files.push(fullPath);
    }
  }

  return Result.ok(files.sort((a, b) => a.localeCompare(b)));
}

function getScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".mts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".cts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  if (filePath.endsWith(".mjs")) return ts.ScriptKind.JS;
  if (filePath.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

function mapFoundationSpecifier(specifier: string): string | undefined {
  return FOUNDATION_IMPORT_MAP[specifier as keyof typeof FOUNDATION_IMPORT_MAP];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectRemainingFoundationImports(
  content: string
): Set<FoundationPackage> {
  const remaining = new Set<FoundationPackage>();

  for (const foundationPackage of FOUNDATION_PACKAGES) {
    const pattern = new RegExp(
      `["']${escapeRegex(foundationPackage)}(?:\\/[^"'\\s]+)?["']`
    );
    if (pattern.test(content)) {
      remaining.add(foundationPackage);
    }
  }

  return remaining;
}

function mergeFoundationImportsForPackage(
  byPackage: Map<string, Set<FoundationPackage>>,
  packageDir: string,
  imports: ReadonlySet<FoundationPackage>
): void {
  if (imports.size === 0) {
    return;
  }

  const existing = byPackage.get(packageDir);
  if (existing) {
    for (const importPath of imports) {
      existing.add(importPath);
    }
    return;
  }

  byPackage.set(packageDir, new Set(imports));
}

function findOwningPackageDir(
  filePath: string,
  packageDirs: readonly string[]
): string | undefined {
  const normalizedFilePath = normalizePath(filePath);

  for (const packageDir of packageDirs) {
    const normalizedPackageDir = normalizePath(packageDir);
    if (
      normalizedFilePath === normalizedPackageDir ||
      normalizedFilePath.startsWith(`${normalizedPackageDir}/`)
    ) {
      return packageDir;
    }
  }

  return undefined;
}

function quoteForLiteral(literalText: string): '"' | "'" {
  return literalText.startsWith("'") ? "'" : '"';
}

function enqueueModuleSpecifierReplacement(
  sourceFile: ts.SourceFile,
  literal: ts.StringLiteral,
  replacements: Replacement[]
): boolean {
  const mapped = mapFoundationSpecifier(literal.text);
  if (!mapped) {
    return false;
  }

  const quote = quoteForLiteral(literal.getText(sourceFile));
  replacements.push({
    start: literal.getStart(sourceFile),
    end: literal.getEnd(),
    text: `${quote}${mapped}${quote}`,
  });
  return true;
}

function enqueueImportTypeReplacement(
  sourceFile: ts.SourceFile,
  node: ts.ImportTypeNode,
  replacements: Replacement[]
): boolean {
  const argument = node.argument;
  if (!ts.isLiteralTypeNode(argument)) {
    return false;
  }

  if (!ts.isStringLiteral(argument.literal)) {
    return false;
  }

  return enqueueModuleSpecifierReplacement(
    sourceFile,
    argument.literal,
    replacements
  );
}

function enqueueCallExpressionReplacement(
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
  replacements: Replacement[]
): boolean {
  const [firstArg] = node.arguments;
  if (!(firstArg && ts.isStringLiteral(firstArg))) {
    return false;
  }

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequireCall =
    ts.isIdentifier(node.expression) && node.expression.text === "require";

  if (!(isDynamicImport || isRequireCall)) {
    return false;
  }

  return enqueueModuleSpecifierReplacement(sourceFile, firstArg, replacements);
}

function applyReplacements(
  content: string,
  replacements: readonly Replacement[]
): string {
  if (replacements.length === 0) {
    return content;
  }

  let next = content;
  const ordered = [...replacements].sort((a, b) => b.start - a.start);

  for (const replacement of ordered) {
    next =
      next.slice(0, replacement.start) +
      replacement.text +
      next.slice(replacement.end);
  }

  return next;
}

function rewriteFoundationImports(
  filePath: string
): Result<{ content: string; rewrites: number }, MigrateKitError> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new MigrateKitError(`Failed to read source file ${filePath}: ${message}`)
    );
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  );

  const replacements: Replacement[] = [];
  let rewrites = 0;

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        enqueueModuleSpecifierReplacement(
          sourceFile,
          node.moduleSpecifier,
          replacements
        )
      ) {
        rewrites += 1;
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        enqueueModuleSpecifierReplacement(
          sourceFile,
          node.moduleSpecifier,
          replacements
        )
      ) {
        rewrites += 1;
      }
    } else if (ts.isImportTypeNode(node)) {
      if (enqueueImportTypeReplacement(sourceFile, node, replacements)) {
        rewrites += 1;
      }
    } else if (
      ts.isCallExpression(node) &&
      enqueueCallExpressionReplacement(sourceFile, node, replacements)
    ) {
      rewrites += 1;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (replacements.length === 0) {
    return Result.ok({ content, rewrites: 0 });
  }

  return Result.ok({
    content: applyReplacements(content, replacements),
    rewrites,
  });
}

function sortRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function rewriteManifestDependencies(
  content: string,
  options?: {
    keepFoundationPackages?: ReadonlySet<FoundationPackage>;
    addKitDependency?: boolean;
  }
): Result<{ content: string; changed: boolean }, MigrateKitError> {
  let manifest: ManifestRecord;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Result.err(
        new MigrateKitError("package.json must contain an object")
      );
    }
    manifest = parsed as ManifestRecord;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new MigrateKitError(`Invalid package.json JSON: ${message}`)
    );
  }

  const keepFoundationPackages = options?.keepFoundationPackages;
  const addKitDependency = options?.addKitDependency ?? false;
  let changed = false;
  let kitVersionCandidate: string | undefined;
  let kitSectionCandidate: DependencySection | undefined;

  for (const section of DEPENDENCY_SECTIONS) {
    const current = manifest[section];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue;
    }

    const deps = { ...(current as Record<string, unknown>) };

    for (const foundationName of FOUNDATION_PACKAGES) {
      const version = deps[foundationName];
      if (typeof version !== "string") {
        continue;
      }

      if (!kitVersionCandidate) {
        kitVersionCandidate = version;
        kitSectionCandidate = section;
      }

      if (keepFoundationPackages?.has(foundationName)) {
        continue;
      }

      delete deps[foundationName];
      changed = true;
    }

    manifest[section] = sortRecord(deps);
  }

  let hasKitDependency = false;
  for (const section of DEPENDENCY_SECTIONS) {
    const current = manifest[section];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue;
    }

    const deps = current as Record<string, unknown>;
    if (typeof deps["@outfitter/kit"] === "string") {
      hasKitDependency = true;
      break;
    }
  }

  const shouldAddKit = addKitDependency || changed;
  if (kitVersionCandidate && shouldAddKit && !hasKitDependency) {
    const targetSection = kitSectionCandidate ?? "dependencies";
    const existingSection = manifest[targetSection];
    const deps =
      existingSection &&
      typeof existingSection === "object" &&
      !Array.isArray(existingSection)
        ? { ...(existingSection as Record<string, unknown>) }
        : {};

    deps["@outfitter/kit"] = kitVersionCandidate;
    manifest[targetSection] = sortRecord(deps);
    changed = true;
  }

  if (!changed) {
    return Result.ok({ content, changed: false });
  }

  return Result.ok({
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    changed: true,
  });
}

interface DiffOp {
  readonly type: "equal" | "remove" | "add";
  readonly line: string;
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}

function createLineDiff(before: string, after: string): DiffOp[] {
  const left = splitLines(before);
  const right = splitLines(after);
  const rows = left.length + 1;
  const cols = right.length + 1;

  const lcs: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0)
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    const row = lcs[i];
    if (!row) {
      continue;
    }

    for (let j = right.length - 1; j >= 0; j -= 1) {
      const leftLine = left[i];
      const rightLine = right[j];

      if (leftLine === rightLine) {
        row[j] = 1 + (lcs[i + 1]?.[j + 1] ?? 0);
      } else {
        row[j] = Math.max(lcs[i + 1]?.[j] ?? 0, lcs[i]?.[j + 1] ?? 0);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const leftLine = left[i];
    const rightLine = right[j];
    if (leftLine === undefined || rightLine === undefined) {
      break;
    }

    if (leftLine === rightLine) {
      ops.push({ type: "equal", line: leftLine });
      i += 1;
      j += 1;
      continue;
    }

    if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      ops.push({ type: "remove", line: leftLine });
      i += 1;
    } else {
      ops.push({ type: "add", line: rightLine });
      j += 1;
    }
  }

  while (i < left.length) {
    const line = left[i];
    if (line === undefined) break;
    ops.push({ type: "remove", line });
    i += 1;
  }

  while (j < right.length) {
    const line = right[j];
    if (line === undefined) break;
    ops.push({ type: "add", line });
    j += 1;
  }

  return ops;
}

function createUnifiedDiff(
  filePath: string,
  before: string,
  after: string
): string {
  if (before === after) {
    return "";
  }

  const ops = createLineDiff(before, after);
  const context = 3;
  const changedIndexes = ops
    .map((op, index) => (op.type === "equal" ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) {
    return "";
  }

  const firstChanged = changedIndexes[0];
  if (firstChanged === undefined) {
    return "";
  }

  const hunks: Array<{ start: number; end: number }> = [];
  let groupStart = firstChanged;
  let previous = firstChanged;

  for (let index = 1; index < changedIndexes.length; index += 1) {
    const current = changedIndexes[index];
    if (current === undefined) {
      continue;
    }
    if (current - previous <= context * 2) {
      previous = current;
      continue;
    }

    hunks.push({
      start: Math.max(0, groupStart - context),
      end: Math.min(ops.length, previous + context + 1),
    });
    groupStart = current;
    previous = current;
  }

  hunks.push({
    start: Math.max(0, groupStart - context),
    end: Math.min(ops.length, previous + context + 1),
  });

  const oldLineAt: number[] = [];
  const newLineAt: number[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const op of ops) {
    oldLineAt.push(oldLine);
    newLineAt.push(newLine);
    if (op.type !== "add") {
      oldLine += 1;
    }
    if (op.type !== "remove") {
      newLine += 1;
    }
  }

  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

  for (const hunk of hunks) {
    const oldStart = oldLineAt[hunk.start] ?? 1;
    const newStart = newLineAt[hunk.start] ?? 1;
    let oldCount = 0;
    let newCount = 0;

    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (!op) {
        continue;
      }
      if (op.type !== "add") {
        oldCount += 1;
      }
      if (op.type !== "remove") {
        newCount += 1;
      }
    }

    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);

    for (let index = hunk.start; index < hunk.end; index += 1) {
      const op = ops[index];
      if (!op) {
        continue;
      }
      if (op.type === "equal") {
        lines.push(` ${op.line}`);
      } else if (op.type === "remove") {
        lines.push(`-${op.line}`);
      } else {
        lines.push(`+${op.line}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeChanges(
  changes: readonly ChangeSet[],
  dryRun: boolean
): Result<void, MigrateKitError> {
  if (dryRun) {
    return Result.ok(undefined);
  }

  for (const change of changes) {
    try {
      writeFileSync(change.path, change.after, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return Result.err(
        new MigrateKitError(`Failed to write ${change.path}: ${message}`)
      );
    }
  }

  return Result.ok(undefined);
}

/**
 * Runs the migrate-kit codemod programmatically.
 */
// biome-ignore lint/suspicious/useAwait: async for API consistency with other command runners.
export async function runMigrateKit(
  options: MigrateKitOptions
): Promise<Result<MigrateKitResult, MigrateKitError>> {
  const targetDir = resolve(options.targetDir ?? process.cwd());
  const dryRun = options.dryRun ?? false;

  const packageJsonResult = collectPackageJsonFiles(targetDir);
  if (packageJsonResult.isErr()) {
    return packageJsonResult;
  }
  const packageJsonFiles = packageJsonResult.value;
  const packageDirectories = Array.from(
    new Set(packageJsonFiles.map((path) => resolve(dirname(path))))
  ).sort((left, right) => right.length - left.length);

  const sourceSet = new Set<string>();
  for (const packageDir of packageDirectories) {
    const sourceFilesResult = collectSourceFiles(packageDir);
    if (sourceFilesResult.isErr()) {
      return sourceFilesResult;
    }

    for (const file of sourceFilesResult.value) {
      sourceSet.add(file);
    }
  }
  const sourceFiles = Array.from(sourceSet).sort((a, b) => a.localeCompare(b));
  const remainingFoundationImportsByPackage = new Map<
    string,
    Set<FoundationPackage>
  >();
  const rewritesByPackage = new Map<string, number>();

  const changes: ChangeSet[] = [];
  const diffs: DiffPreview[] = [];
  let importRewrites = 0;
  let manifestUpdates = 0;

  for (const sourceFile of sourceFiles) {
    const rewriteResult = rewriteFoundationImports(sourceFile);
    if (rewriteResult.isErr()) {
      return rewriteResult;
    }

    const packageDir = findOwningPackageDir(sourceFile, packageDirectories);
    if (packageDir) {
      const remainingImports = collectRemainingFoundationImports(
        rewriteResult.value.content
      );
      mergeFoundationImportsForPackage(
        remainingFoundationImportsByPackage,
        packageDir,
        remainingImports
      );

      if (rewriteResult.value.rewrites > 0) {
        rewritesByPackage.set(
          packageDir,
          (rewritesByPackage.get(packageDir) ?? 0) +
            rewriteResult.value.rewrites
        );
      }
    }

    if (rewriteResult.value.rewrites === 0) {
      continue;
    }

    const before = readFileSync(sourceFile, "utf-8");
    const after = rewriteResult.value.content;
    if (before === after) {
      continue;
    }

    importRewrites += rewriteResult.value.rewrites;
    const path = normalizePath(relative(targetDir, sourceFile));
    changes.push({ path: sourceFile, before, after });
    diffs.push({ path, preview: createUnifiedDiff(path, before, after) });
  }

  for (const packageJsonPath of packageJsonFiles) {
    let before: string;
    try {
      before = readFileSync(packageJsonPath, "utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return Result.err(
        new MigrateKitError(`Failed to read ${packageJsonPath}: ${message}`)
      );
    }

    const packageDir = resolve(dirname(packageJsonPath));
    const keepFoundationPackages =
      remainingFoundationImportsByPackage.get(packageDir);
    const rewriteResult = rewriteManifestDependencies(before, {
      ...(keepFoundationPackages ? { keepFoundationPackages } : {}),
      addKitDependency: (rewritesByPackage.get(packageDir) ?? 0) > 0,
    });
    if (rewriteResult.isErr()) {
      return rewriteResult;
    }

    if (
      !rewriteResult.value.changed ||
      rewriteResult.value.content === before
    ) {
      continue;
    }

    manifestUpdates += 1;
    const path = normalizePath(relative(targetDir, packageJsonPath));
    changes.push({
      path: packageJsonPath,
      before,
      after: rewriteResult.value.content,
    });
    diffs.push({
      path,
      preview: createUnifiedDiff(path, before, rewriteResult.value.content),
    });
  }

  const writeResult = writeChanges(changes, dryRun);
  if (writeResult.isErr()) {
    return writeResult;
  }

  const changedFiles = changes
    .map((change) => normalizePath(relative(targetDir, change.path)))
    .sort((a, b) => a.localeCompare(b));

  return Result.ok({
    targetDir,
    dryRun,
    packageJsonFiles: packageJsonFiles.length,
    sourceFiles: sourceFiles.length,
    manifestUpdates,
    importRewrites,
    changedFiles,
    diffs: diffs.sort((left, right) => left.path.localeCompare(right.path)),
  });
}

/**
 * Print migrate-kit results.
 */
export async function printMigrateKitResults(
  result: MigrateKitResult,
  options?: { mode?: OutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    await output(result, { mode: structuredMode });
    return;
  }

  const lines: string[] = [];

  if (result.changedFiles.length === 0) {
    lines.push("No kit migration changes needed.");
    await output(lines);
    return;
  }

  lines.push(
    result.dryRun
      ? "Dry run complete. No files were written."
      : "Migration complete.",
    ""
  );
  lines.push(`Changed files: ${result.changedFiles.length}`);
  lines.push(`Import rewrites: ${result.importRewrites}`);
  lines.push(`Manifest updates: ${result.manifestUpdates}`, "");

  for (const file of result.changedFiles) {
    lines.push(`  - ${file}`);
  }

  if (result.dryRun && result.diffs.length > 0) {
    lines.push("", "Diff preview:", "");
    for (const diff of result.diffs) {
      lines.push(diff.preview.trimEnd(), "");
    }
  }

  await output(lines);
}

/**
 * Register `migrate kit` command directly on Commander.
 */
export function migrateKitCommand(program: Command): void {
  interface CliFlags {
    readonly dryRun?: unknown;
    readonly json?: unknown;
  }

  const existingMigrate = program.commands.find(
    (command) => command.name() === "migrate"
  );
  const migrate =
    existingMigrate ??
    program.command("migrate").description("Migration commands");

  if (migrate.commands.some((command) => command.name() === "kit")) {
    return;
  }

  migrate
    .command("kit [directory]")
    .description(
      "Migrate foundation imports and dependencies to @outfitter/kit"
    )
    .option("--dry-run", "Preview changes without writing files", false)
    .option("--json", "Output result as JSON", false)
    .action(async (directory: string | undefined, flags: CliFlags) => {
      if (flags.json) {
        process.env["OUTFITTER_JSON"] = "1";
      }

      const result = await runMigrateKit({
        ...(directory ? { targetDir: directory } : {}),
        dryRun: Boolean(flags.dryRun),
      });

      if (result.isErr()) {
        throw result.error;
      }

      await printMigrateKitResults(
        result.value,
        flags.json ? { mode: "json" } : undefined
      );
    });
}
