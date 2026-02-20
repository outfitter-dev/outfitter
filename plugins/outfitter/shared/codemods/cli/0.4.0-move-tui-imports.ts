/**
 * Codemod: Move TUI imports from @outfitter/cli to @outfitter/tui.
 *
 * Rewrites:
 * - `@outfitter/cli/render`    → `@outfitter/tui/render`
 * - `@outfitter/cli/streaming` → `@outfitter/tui/streaming`
 * - `@outfitter/cli/input`     → `@outfitter/tui/confirm`
 *
 * Text-based import rewriting — no AST required.
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

const IMPORT_REWRITES: ReadonlyArray<{ from: string; to: string }> = [
  { from: "@outfitter/cli/render", to: "@outfitter/tui/render" },
  { from: "@outfitter/cli/streaming", to: "@outfitter/tui/streaming" },
  { from: "@outfitter/cli/input", to: "@outfitter/tui/confirm" },
];

const IMPORT_SPECIFIER_PATTERNS = [
  /(import\s+(?:type\s+)?[\s\S]*?\bfrom\s*["'])([^"']+)(["'])/g,
  /(export\s+[\s\S]*?\bfrom\s*["'])([^"']+)(["'])/g,
  /(import\s*["'])([^"']+)(["'])/g,
  /(import\s*\(\s*["'])([^"']+)(["']\s*\))/g,
  /(require\s*\(\s*["'])([^"']+)(["']\s*\))/g,
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

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}");

  for (const entry of glob.scanSync({ cwd: dir })) {
    // Skip ignored directories
    const parts = entry.split("/");
    if (parts.some((p) => IGNORED_DIRECTORIES.has(p))) continue;

    // Verify extension
    const ext = `.${entry.split(".").pop()}`;
    if (!SOURCE_EXTENSIONS.has(ext)) continue;

    files.push(entry);
  }

  return files;
}

function rewriteModuleSpecifier(specifier: string): string {
  for (const rewrite of IMPORT_REWRITES) {
    if (specifier === rewrite.from) {
      return rewrite.to;
    }
  }
  return specifier;
}

function rewriteImportSpecifiers(content: string): string {
  let updated = content;

  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    updated = updated.replace(pattern, (full, prefix, specifier, suffix) => {
      if (
        typeof prefix !== "string" ||
        typeof specifier !== "string" ||
        typeof suffix !== "string"
      ) {
        return full;
      }

      const rewritten = rewriteModuleSpecifier(specifier);
      if (rewritten === specifier) return full;
      return `${prefix}${rewritten}${suffix}`;
    });
  }

  return updated;
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

    // Check if file contains any of the old import paths
    let hasMatch = false;
    for (const rewrite of IMPORT_REWRITES) {
      if (content.includes(rewrite.from)) {
        hasMatch = true;
        break;
      }
    }

    if (!hasMatch) {
      continue;
    }

    const updated = rewriteImportSpecifiers(content);

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
