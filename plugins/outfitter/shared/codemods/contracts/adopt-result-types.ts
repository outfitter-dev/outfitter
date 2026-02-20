/**
 * Codemod: Adopt Result types — transform throw-based error handling.
 *
 * Transforms:
 * - `throw new Error(msg)` → `return Result.err(InternalError.create(msg))`
 * - `throw new XError(...)` → `return Result.err(new XError(...))` (known Outfitter errors)
 * - `return value` → `return Result.ok(value)` (in functions with Result.err returns)
 *
 * Text-based transforms — no AST required.
 *
 * @packageDocumentation
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface CodemodOptions {
  readonly dryRun: boolean;
  readonly targetDir: string;
}

interface CodemodResult {
  readonly changedFiles: readonly string[];
  readonly errors: readonly string[];
  readonly skippedFiles: readonly string[];
}

/**
 * Known Outfitter error classes from @outfitter/contracts.
 * These get `return Result.err(new XError(...))`.
 */
const KNOWN_ERRORS = new Set([
  "ValidationError",
  "NotFoundError",
  "ConflictError",
  "PermissionError",
  "TimeoutError",
  "RateLimitError",
  "NetworkError",
  "InternalError",
  "AuthError",
  "CancelledError",
  "AlreadyExistsError",
  "AmbiguousError",
  "AssertionError",
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

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}");

  for (const entry of glob.scanSync({ cwd: dir })) {
    const parts = entry.split("/");
    if (parts.some((p) => IGNORED_DIRECTORIES.has(p))) continue;
    files.push(entry);
  }

  return files;
}

/**
 * Transform a single-line `throw new Error(...)` to `return Result.err(InternalError.create(...))`.
 * Returns the transformed line, or null if no match.
 */
function transformThrowError(line: string): string | null {
  const match = line.match(/^(\s*)throw\s+new\s+Error\((.+)\);?\s*$/);
  if (!match) return null;

  const indent = match[1] ?? "";
  const args = match[2] ?? "";
  return `${indent}return Result.err(InternalError.create(${args}));`;
}

/**
 * Transform `throw new XError(...)` where X is a known Outfitter error.
 * Returns the transformed line, or null if no match.
 */
function transformThrowKnownError(line: string): string | null {
  const match = line.match(/^(\s*)throw\s+new\s+(\w+Error)\((.+)\);?\s*$/);
  if (!match) return null;

  const indent = match[1] ?? "";
  const errorClass = match[2] ?? "";
  const args = match[3] ?? "";

  if (!KNOWN_ERRORS.has(errorClass)) return null;

  return `${indent}return Result.err(new ${errorClass}(${args}));`;
}

/**
 * Transform multiline throw statements.
 * Detects `throw new Error(\n  ...\n);` patterns and collapses them.
 */
function transformMultilineThrows(content: string): string {
  // Match: throw new Error(\n  "msg"\n);
  const multilineThrowError =
    /^(\s*)throw\s+new\s+Error\(\s*\n([\s\S]*?)\n\s*\);/gm;
  let result = content;

  result = result.replace(multilineThrowError, (_match, indent, body) => {
    const trimmedBody = (body as string).trim();
    return `${indent}return Result.err(InternalError.create(${trimmedBody}));`;
  });

  // Match: throw new KnownError(\n  ...\n);
  for (const errorClass of KNOWN_ERRORS) {
    const pattern = new RegExp(
      `^(\\s*)throw\\s+new\\s+${errorClass}\\(\\s*\\n([\\s\\S]*?)\\n\\s*\\);`,
      "gm"
    );
    result = result.replace(pattern, (_match, indent, body) => {
      const trimmedBody = (body as string).trim();
      return `${indent}return Result.err(new ${errorClass}(${trimmedBody}));`;
    });
  }

  return result;
}

interface FunctionScope {
  readonly endLine: number;
  readonly hasResultErr: boolean;
  readonly startLine: number;
}

interface OpenFunctionScope {
  readonly depthBeforeBody: number;
  hasResultErr: boolean;
  readonly startLine: number;
}

function countChar(line: string, char: string): number {
  let count = 0;
  for (const c of line) {
    if (c === char) count++;
  }
  return count;
}

const CONTROL_FLOW_START_REGEX =
  /^\s*(if|for|while|switch|catch|else|try|do)\b/;
const CLASS_METHOD_START_REGEX =
  /^\s*(?:(?:public|private|protected|static|readonly|override|abstract|async)\s+)*(?:get\s+|set\s+)?\*?[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::\s*[^={]+)?\s*\{/;
const COMPUTED_METHOD_START_REGEX =
  /^\s*(?:(?:public|private|protected|static|readonly|override|abstract|async)\s+)*(?:get\s+|set\s+)?\[[^\]]+\]\s*\([^)]*\)\s*(?::\s*[^={]+)?\s*\{/;

function isFunctionStartLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("{")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("=>")) return true;
  if (/\bfunction\b/.test(trimmed)) return true;
  if (CONTROL_FLOW_START_REGEX.test(trimmed)) return false;
  return (
    CLASS_METHOD_START_REGEX.test(trimmed) ||
    COMPUTED_METHOD_START_REGEX.test(trimmed)
  );
}

function findFunctionScopes(lines: string[]): FunctionScope[] {
  const scopes: FunctionScope[] = [];
  const openScopes: OpenFunctionScope[] = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (isFunctionStartLine(line)) {
      openScopes.push({
        startLine: i,
        depthBeforeBody: braceDepth,
        hasResultErr: false,
      });
    }

    if (line.includes("Result.err(")) {
      const innermostScope = openScopes.at(-1);
      if (innermostScope) {
        innermostScope.hasResultErr = true;
      }
    }

    braceDepth += countChar(line, "{");
    braceDepth -= countChar(line, "}");

    while (openScopes.length > 0) {
      const scope = openScopes.at(-1);
      if (!scope || braceDepth > scope.depthBeforeBody) {
        break;
      }
      openScopes.pop();
      scopes.push({
        startLine: scope.startLine,
        endLine: i,
        hasResultErr: scope.hasResultErr,
      });
    }
  }

  return scopes;
}

function getInnermostScope(
  scopes: readonly FunctionScope[],
  lineIndex: number
): FunctionScope | undefined {
  let best: FunctionScope | undefined;
  for (const scope of scopes) {
    if (lineIndex < scope.startLine || lineIndex > scope.endLine) continue;
    if (!best) {
      best = scope;
      continue;
    }
    const bestWidth = best.endLine - best.startLine;
    const scopeWidth = scope.endLine - scope.startLine;
    if (scopeWidth < bestWidth) {
      best = scope;
    }
  }
  return best;
}

/**
 * Transform `return value` to `return Result.ok(value)` for non-void returns
 * in function bodies that contain `Result.err`.
 */
function transformReturns(content: string): string {
  if (!content.includes("Result.err(")) return content;

  const lines = content.split("\n");
  const scopes = findFunctionScopes(lines);
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Skip lines that already use Result
    if (line.includes("Result.ok(") || line.includes("Result.err(")) {
      result.push(line);
      i++;
      continue;
    }

    // Skip bare returns (return; or return with nothing)
    if (/^\s*return\s*;?\s*$/.test(line)) {
      result.push(line);
      i++;
      continue;
    }

    // Skip import/export return-like lines
    if (/^\s*(import|export)\s/.test(line)) {
      result.push(line);
      i++;
      continue;
    }

    const innermostScope = getInnermostScope(scopes, i);
    if (!innermostScope?.hasResultErr) {
      result.push(line);
      i++;
      continue;
    }

    // Match `return <value>;`
    const match = line.match(/^(\s*)return\s+(.+);(\s*)$/);
    if (match) {
      const indent = match[1] ?? "";
      const value = match[2] ?? "";
      const trailing = match[3] ?? "";

      // Don't wrap if value is already a Result call
      if (value.startsWith("Result.")) {
        result.push(line);
        i++;
        continue;
      }

      result.push(`${indent}return Result.ok(${value});${trailing}`);
      i++;
      continue;
    }

    // Handle multiline returns:
    // return (
    //   value
    // );
    const multilineStart = line.match(/^(\s*)return\s+(.+)$/);
    if (!multilineStart) {
      result.push(line);
      i++;
      continue;
    }

    const indent = multilineStart[1] ?? "";
    const firstLineValue = multilineStart[2] ?? "";
    if (firstLineValue.startsWith("Result.")) {
      result.push(line);
      i++;
      continue;
    }

    const blockLines: string[] = [firstLineValue];
    let endLine = i;
    let hasTerminator = /;\s*$/.test(line);

    while (!hasTerminator && endLine + 1 < lines.length) {
      endLine += 1;
      const nextLine = lines[endLine] ?? "";
      blockLines.push(nextLine);
      hasTerminator = /;\s*$/.test(nextLine);
    }

    if (!hasTerminator) {
      result.push(line);
      i++;
      continue;
    }

    const lastLineIndex = blockLines.length - 1;
    const lastLine = blockLines[lastLineIndex] ?? "";
    const terminalMatch = lastLine.match(/^(.*);(\s*)$/);
    if (!terminalMatch) {
      result.push(...lines.slice(i, endLine + 1));
      i = endLine + 1;
      continue;
    }

    blockLines[lastLineIndex] = terminalMatch[1] ?? "";
    const trailing = terminalMatch[2] ?? "";
    const value = blockLines.join("\n");

    result.push(`${indent}return Result.ok(${value});${trailing}`);
    i = endLine + 1;
  }

  return result.join("\n");
}

/**
 * Ensure the file has `Result` and `InternalError` imports from @outfitter/contracts.
 */
function ensureImports(content: string, needsInternalError: boolean): string {
  // Find existing value import from @outfitter/contracts
  const contractsImportMatch = content.match(
    /^import\s+\{([\s\S]*?)\}\s+from\s+["']@outfitter\/contracts["'];?/m
  );

  if (contractsImportMatch) {
    const specifiers =
      contractsImportMatch[1]
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];

    if (!specifiers.includes("Result")) {
      specifiers.push("Result");
    }
    if (needsInternalError && !specifiers.includes("InternalError")) {
      specifiers.push("InternalError");
    }

    specifiers.sort();
    const newImport = `import { ${specifiers.join(", ")} } from "@outfitter/contracts";`;
    return content.replace(contractsImportMatch[0], newImport);
  }

  // No existing import — add one at the top (after any existing imports)
  const needed: string[] = [];
  if (needsInternalError) needed.push("InternalError");
  needed.push("Result");
  needed.sort();

  const importStatement = `import { ${needed.join(", ")} } from "@outfitter/contracts";\n`;

  // Find the last import line to insert after
  const lines = content.split("\n");
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^import\s/.test(line)) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement.trimEnd());
    return lines.join("\n");
  }

  // No imports at all — add at the very top
  return importStatement + content;
}

export async function transform(
  options: CodemodOptions
): Promise<CodemodResult> {
  const { targetDir, dryRun } = options;
  const changedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const errors: string[] = [];

  const sourceFiles = collectSourceFiles(targetDir);

  for (const relPath of sourceFiles) {
    const absPath = join(targetDir, relPath);

    let content: string;
    try {
      content = readFileSync(absPath, "utf-8");
    } catch {
      errors.push(`Failed to read: ${relPath}`);
      continue;
    }

    // Skip files that don't have throw statements
    if (!/throw\s+new\s+/.test(content)) {
      continue;
    }

    let updated = content;
    let needsInternalError = false;

    // Phase 1: Transform multiline throws first
    updated = transformMultilineThrows(updated);
    if (updated.includes("InternalError.create(")) {
      needsInternalError = true;
    }

    // Phase 2: Transform single-line throws
    const lines = updated.split("\n");
    const transformed: string[] = [];

    for (const line of lines) {
      // Try known Outfitter errors first (more specific match)
      const knownResult = transformThrowKnownError(line);
      if (knownResult !== null) {
        transformed.push(knownResult);
        continue;
      }

      // Try generic Error
      const errorResult = transformThrowError(line);
      if (errorResult !== null) {
        transformed.push(errorResult);
        needsInternalError = true;
        continue;
      }

      transformed.push(line);
    }

    updated = transformed.join("\n");

    // Phase 3: Wrap plain returns with Result.ok()
    updated = transformReturns(updated);

    // Phase 4: Ensure imports
    if (updated !== content) {
      updated = ensureImports(updated, needsInternalError);
    }

    if (updated === content) {
      skippedFiles.push(relPath);
      continue;
    }

    if (dryRun) {
      changedFiles.push(relPath);
      continue;
    }

    try {
      writeFileSync(absPath, updated);
      changedFiles.push(relPath);
    } catch {
      errors.push(`Failed to write: ${relPath}`);
    }
  }

  return { changedFiles, skippedFiles, errors };
}
