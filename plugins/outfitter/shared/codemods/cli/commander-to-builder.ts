/**
 * Codemod: Commander-to-builder — transform .command().action() to .input(schema).action().
 *
 * Detects Commander-style patterns:
 * - `new Command("name").option(...).action(fn)`
 * - `.command("name").option(...).action(fn)`
 *
 * Transforms to the builder pattern:
 * - Generates Zod schema skeleton from .option()/.argument() declarations
 * - Inserts `.input(schema)` before `.action()`
 * - Adds `import { z } from "zod"` if not present
 *
 * Commands too complex for automatic transformation are left as-is and reported
 * as skipped (e.g., files with multiple .command() calls, nested subcommands).
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

/** Parsed option from a .option() or .requiredOption() call. */
interface ParsedOption {
  /** Default value string, if provided */
  readonly defaultValue?: string;
  /** Description from the second argument */
  readonly description: string;
  /** Long flag name (camelCase key) */
  readonly key: string;
  /** Whether the option is negated (--no-xxx) */
  readonly negated: boolean;
  /** Whether the value argument uses optional brackets [value] */
  readonly optionalValue: boolean;
  /** Whether this was a .requiredOption() */
  readonly required: boolean;
  /** "string" | "boolean" | "number" */
  readonly type: "boolean" | "number" | "string";
}

/** Parsed positional argument from .argument() calls. */
interface ParsedArgument {
  readonly description: string;
  readonly name: string;
  readonly required: boolean;
}

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

/**
 * Command directory patterns to restrict scanning.
 *
 * Only scans directories that are likely to contain CLI command definitions:
 * - `apps/* /src/commands/` — app-level command directories
 * - `src/commands/` — when targetDir is already an app
 * - `commands/` — flat command directories
 *
 * This avoids false positives on library implementation files in `packages/`
 * that happen to use Commander patterns internally.
 */
const COMMAND_DIR_GLOBS = [
  "apps/*/src/commands/**/*.{ts,tsx,mts}",
  "src/commands/**/*.{ts,tsx,mts}",
  "commands/**/*.{ts,tsx,mts}",
];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const seen = new Set<string>();

  for (const pattern of COMMAND_DIR_GLOBS) {
    const glob = new Bun.Glob(pattern);

    for (const entry of glob.scanSync({ cwd: dir })) {
      const parts = entry.split("/");
      if (parts.some((p) => IGNORED_DIRECTORIES.has(p))) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      files.push(entry);
    }
  }

  return files;
}

// =============================================================================
// Pattern Detection
// =============================================================================

/** Check if a file uses the Commander pattern (new Command or .command()). */
function hasCommanderPattern(content: string): boolean {
  return (
    content.includes("new Command(") ||
    (content.includes(".command(") && content.includes(".action("))
  );
}

/** Check if a file already uses the builder .input() pattern (already migrated). */
function isAlreadyMigrated(content: string): boolean {
  return content.includes(".input(") && content.includes("z.object(");
}

/** Check if a file contains any Commander-related content worth examining. */
function hasAnyCommandPattern(content: string): boolean {
  return (
    hasCommanderPattern(content) ||
    isAlreadyMigrated(content) ||
    (content.includes("command(") && content.includes(".action("))
  );
}

/** Count occurrences of .command() calls to detect nested subcommands. */
function countCommandCalls(content: string): number {
  const matches = content.match(/\.command\s*\(/g);
  return matches?.length ?? 0;
}

/** Determine if a file is too complex for automatic transformation. */
function isTooComplex(content: string): boolean {
  // Multiple .command() calls = nested subcommands
  if (countCommandCalls(content) > 1) return true;

  // Dynamic command creation patterns
  if (content.includes("for (") && content.includes(".command(")) return true;
  if (content.includes("forEach(") && content.includes(".command("))
    return true;

  return false;
}

// =============================================================================
// Option Parsing
// =============================================================================

/**
 * Parse a single .option() or .requiredOption() call from source text.
 *
 * Handles patterns like:
 * - `.option("--name <name>", "Description")`
 * - `.option("--verbose", "Enable verbose")`
 * - `.option("-n, --name <name>", "Description", "default")`
 * - `.option("--no-cache", "Disable cache")`
 * - `.requiredOption("--name <name>", "Description")`
 */
function parseOptionCall(
  line: string,
  isRequired: boolean
): ParsedOption | null {
  // Match .option("flags", "description") or .option("flags", "description", "default")
  // Match patterns with optional default value
  const optionMatch = line.match(
    /\.(option|requiredOption)\(\s*(['"])(.*?)\2\s*,\s*(['"])(.*?)\4(?:\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^)]+))?\s*\)/
  );
  if (!optionMatch) return null;

  const flags = optionMatch[3] ?? "";
  const description = optionMatch[5] ?? "";
  const defaultRaw = optionMatch[6]?.trim();

  // Extract the long flag name
  const longFlagMatch = flags.match(/--(?:no-)?([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!longFlagMatch) return null;

  const rawKey = longFlagMatch[1] ?? "";
  const key = kebabToCamel(rawKey);
  const negated = flags.includes("--no-");

  // Determine type from the flag pattern
  // <value> = required string, [value] = optional string, no value = boolean
  const hasRequiredValueArg = /<[^>]+>/.test(flags);
  const hasOptionalValueArg = /\[[^\]]+\]/.test(flags);
  const hasValueArg = hasRequiredValueArg || hasOptionalValueArg;
  let type: "boolean" | "number" | "string" = hasValueArg
    ? "string"
    : "boolean";

  // Clean up default/parser argument
  let defaultValue: string | undefined;
  if (defaultRaw !== undefined) {
    const { parserExpression, trailingDefault } =
      splitOptionParserAndDefault(defaultRaw);

    if (hasValueArg && isParserExpression(parserExpression)) {
      // Commander parser signature: .option(flags, description, parser, [defaultValue])
      if (isNumericParserExpression(parserExpression)) {
        type = "number";
      }
      defaultValue = trailingDefault;
    } else if (isNumericParserExpression(defaultRaw)) {
      // Parser-only shorthand: .option(flags, description, parseInt)
      type = "number";
    } else if (isQuotedStringLiteral(defaultRaw)) {
      defaultValue = defaultRaw;
    } else {
      defaultValue = defaultRaw;
    }
  }

  return {
    key,
    type,
    description,
    defaultValue,
    required: isRequired,
    negated,
    optionalValue: hasOptionalValueArg,
  };
}

function isQuotedStringLiteral(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function isNumericParserExpression(value: string): boolean {
  return value === "parseInt" || value === "parseFloat" || value === "Number";
}

function isParserExpression(value: string): boolean {
  if (value.length === 0 || isQuotedStringLiteral(value)) {
    return false;
  }

  if (/^(true|false|null|undefined)$/u.test(value)) {
    return false;
  }

  if (/^[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return false;
  }

  if (value.includes("=>") || value.startsWith("function")) {
    return true;
  }

  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/u.test(value);
}

function splitOptionParserAndDefault(raw: string): {
  parserExpression: string;
  trailingDefault: string | undefined;
} {
  let quote: "'" | '"' | null = null;
  let escape = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i] ?? "";

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }
    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (
      char === "," &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      return {
        parserExpression: raw.slice(0, i).trim(),
        trailingDefault: raw.slice(i + 1).trim() || undefined,
      };
    }
  }

  return { parserExpression: raw.trim(), trailingDefault: undefined };
}

/** Parse .argument() calls to detect positional arguments. */
function parseArgumentCall(line: string): ParsedArgument | null {
  const argMatch = line.match(
    /\.argument\(\s*(['"])(.*?)\1\s*(?:,\s*(['"])(.*?)\3)?\s*\)/
  );
  if (!argMatch) return null;

  const argSpec = argMatch[2] ?? "";
  const description = argMatch[4] ?? "";
  const required = argSpec.startsWith("<");
  const name = argSpec.replace(/[<>[\]]/g, "").trim();

  return { name, description, required };
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// =============================================================================
// Schema Generation
// =============================================================================

/** Generate a Zod schema field from a parsed option. */
function generateSchemaField(option: ParsedOption): string {
  const { key, type, description, defaultValue, negated, optionalValue } =
    option;

  let field: string;

  switch (type) {
    case "boolean": {
      const defaultBool = negated ? "true" : "false";
      // Preserve Commander negated-flag defaults: --no-foo maps to foo:boolean default true.
      field = `${key}: z.boolean().default(${defaultBool}).describe("${escapeString(description)}")`;
      break;
    }
    case "number": {
      field = `${key}: z.number().describe("${escapeString(description)}")`;
      break;
    }
    case "string":
    default: {
      if (defaultValue !== undefined) {
        field = `${key}: z.string().default(${defaultValue}).describe("${escapeString(description)}")`;
      } else if (optionalValue) {
        // Square bracket [value] → optional
        field = `${key}: z.string().optional().describe("${escapeString(description)}")`;
      } else {
        // Angle bracket <value> → required
        field = `${key}: z.string().describe("${escapeString(description)}")`;
      }
      break;
    }
  }

  return field;
}

/** Generate a Zod schema field from a parsed positional argument. */
function generateArgumentSchemaField(arg: ParsedArgument): string {
  const { name, description, required } = arg;
  if (required) {
    return `${name}: z.string().describe("${escapeString(description)}")`;
  }
  return `${name}: z.string().optional().describe("${escapeString(description)}")`;
}

function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// =============================================================================
// File Transformation
// =============================================================================

interface TransformResult {
  readonly changed: boolean;
  readonly content: string;
}

/**
 * Transform a single file's content from Commander patterns to builder patterns.
 *
 * Returns the transformed content and whether any changes were made.
 */
function transformFile(content: string): TransformResult {
  const lines = content.split("\n");
  const options: ParsedOption[] = [];
  const positionalArgs: ParsedArgument[] = [];

  // Collect all option/argument declarations
  for (const line of lines) {
    const trimmed = line.trim();

    // Parse .option() and .requiredOption() calls
    if (trimmed.includes(".option(") || trimmed.includes(".requiredOption(")) {
      const isRequired = trimmed.includes(".requiredOption(");
      const parsed = parseOptionCall(trimmed, isRequired);
      if (parsed) {
        options.push(parsed);
      }
    }

    // Parse .argument() calls
    if (trimmed.includes(".argument(")) {
      const parsed = parseArgumentCall(trimmed);
      if (parsed) {
        positionalArgs.push(parsed);
      }
    }
  }

  // If no options and no arguments found, nothing to transform
  if (options.length === 0 && positionalArgs.length === 0) {
    return { content, changed: false };
  }

  // Generate the Zod schema — positional args first, then options
  const argFields = positionalArgs.map(
    (arg) => `  ${generateArgumentSchemaField(arg)},`
  );
  const optFields = options.map((opt) => `  ${generateSchemaField(opt)},`);
  const schemaFields = [...argFields, ...optFields];
  const schemaName = "inputSchema";
  const schemaBlock = [
    `const ${schemaName} = z.object({`,
    ...schemaFields,
    "});",
  ].join("\n");

  // Build the transformed content
  let result = content;

  // Remove .option()/.requiredOption()/.argument() lines and insert .input(schema)
  const newLines: string[] = [];
  let removedDeclarations = false;
  let insertedInput = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Remove .option() and .requiredOption() lines
    if (
      (trimmed.includes(".option(") || trimmed.includes(".requiredOption(")) &&
      parseOptionCall(trimmed, trimmed.includes(".requiredOption("))
    ) {
      removedDeclarations = true;
      continue;
    }

    // Remove .argument() lines (now converted to schema fields)
    if (trimmed.includes(".argument(") && parseArgumentCall(trimmed)) {
      removedDeclarations = true;
      continue;
    }

    // Insert .input(schema) before .action()
    if (trimmed.includes(".action(") && !insertedInput) {
      // Find the indentation of the .action() line
      const indent = line.match(/^(\s*)/)?.[1] ?? "    ";
      newLines.push(`${indent}.input(${schemaName})`);
      insertedInput = true;
    }

    newLines.push(line);
  }

  result = newLines.join("\n");

  // Insert the schema block before the function/export that contains the command
  // Find a good insertion point — before the first function/export that uses Command
  const commandPattern =
    /^(export\s+)?(function|const|let|var)\s+\w+.*(?:Command|command)/m;
  const commandMatch = result.match(commandPattern);

  if (commandMatch?.index !== undefined) {
    const insertPoint = commandMatch.index;
    result =
      result.slice(0, insertPoint) +
      schemaBlock +
      "\n\n" +
      result.slice(insertPoint);
  } else {
    // Fallback: insert after imports
    const lastImportIndex = findLastImportIndex(result);
    if (lastImportIndex >= 0) {
      const beforeInsert = result.slice(0, lastImportIndex);
      const afterInsert = result.slice(lastImportIndex);
      result = beforeInsert + "\n" + schemaBlock + "\n" + afterInsert;
    }
  }

  // Ensure zod import
  result = ensureZodImport(result);

  return {
    content: result,
    changed: true,
  };
}

/**
 * Find the position right after the last import statement.
 */
function findLastImportIndex(content: string): number {
  const lines = content.split("\n");
  let lastImportEnd = -1;
  let charIndex = 0;

  for (const line of lines) {
    charIndex += line.length + 1; // +1 for newline
    if (line.trimStart().startsWith("import ")) {
      lastImportEnd = charIndex;
    }
  }

  return lastImportEnd;
}

/**
 * Ensure `import { z } from "zod"` is present.
 * Adds it if missing, does not duplicate.
 */
function ensureZodImport(content: string): string {
  // Check if zod is already imported
  if (/import\s+.*\bz\b.*from\s+["']zod["']/.test(content)) {
    return content;
  }

  // Find the right place to insert — after other imports
  const lines = content.split("\n");
  let lastImportLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimStart();
    if (line.startsWith("import ") || line.startsWith("import{")) {
      lastImportLine = i;
    }
  }

  const importLine = 'import { z } from "zod";';

  if (lastImportLine >= 0) {
    lines.splice(lastImportLine + 1, 0, importLine);
  } else {
    // No imports found — add at top
    lines.unshift(importLine, "");
  }

  return lines.join("\n");
}

// =============================================================================
// Main Transform
// =============================================================================

/**
 * Codemod entry point: transform Commander patterns to builder patterns.
 */
export async function transform(
  options: CodemodOptions
): Promise<CodemodResult> {
  const { targetDir, dryRun } = options;
  const changedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const errors: string[] = [];

  const files = collectSourceFiles(targetDir);

  for (const relativePath of files) {
    const absolutePath = join(targetDir, relativePath);

    let content: string;
    try {
      content = readFileSync(absolutePath, "utf-8");
    } catch (err) {
      errors.push(
        `Failed to read ${relativePath}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    // Skip files without any Commander-related patterns
    if (!hasAnyCommandPattern(content)) {
      continue;
    }

    // Skip files already migrated to builder pattern
    if (isAlreadyMigrated(content)) {
      skippedFiles.push(relativePath);
      continue;
    }

    // Skip files without transformable Commander patterns
    if (!hasCommanderPattern(content)) {
      continue;
    }

    // Skip complex files (nested subcommands, dynamic patterns)
    if (isTooComplex(content)) {
      skippedFiles.push(relativePath);
      continue;
    }

    // Transform the file
    try {
      const result = transformFile(content);

      if (result.changed) {
        changedFiles.push(relativePath);

        if (!dryRun) {
          writeFileSync(absolutePath, result.content);
        }
      }
    } catch (err) {
      errors.push(
        `Failed to transform ${relativePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { changedFiles, skippedFiles, errors };
}
