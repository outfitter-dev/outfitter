#!/usr/bin/env bun
/**
 * validate-skill-frontmatter.ts
 *
 * Validates SKILL.md frontmatter against the Agent Skills specification.
 * Designed for use as a PreToolUse hook for Write/Edit operations on SKILL.md files.
 *
 * Exit codes:
 *   0 - Valid/skip (proceed with tool use)
 *   2 - Block (critical errors)
 *
 * Input: JSON on stdin from Claude Code PreToolUse hook
 * {
 *   "tool_name": "Write" | "Edit",
 *   "tool_input": { "file_path": string, "content"?: string, "old_string"?: string, "new_string"?: string }
 * }
 */

import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  extractFrontmatter,
  isAllowedToolsCommaSeparated,
  isDescriptionQuoted,
  loadSkillSpec,
} from "./_shared.ts";

const spec = loadSkillSpec();

/**
 * Result of skill frontmatter validation.
 */
interface ValidationResult {
  /** Whether the frontmatter passes all required checks */
  valid: boolean;
  /** Blocking errors that must be fixed */
  errors: string[];
  /** Non-blocking warnings for improvement */
  warnings: string[];
  /** Parsed frontmatter if YAML was valid */
  frontmatter: Record<string, unknown> | null;
}

/**
 * Expected structure of SKILL.md frontmatter.
 */
interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  "allowed-tools"?: string;
  "user-invocable"?: boolean;
  "disable-model-invocation"?: boolean;
  context?: string;
  agent?: string;
  model?: string;
  hooks?: Record<string, string>;
  "argument-hint"?: string;
  [key: string]: unknown;
}

// Field sets from spec (single source of truth)
const BASE_FIELDS = spec.baseFields;
const CLAUDE_FIELDS = spec.claudeFields;

/**
 * Checks if a file path indicates Claude Code context.
 * @param path - File path to check
 * @returns True if path matches Claude skill locations
 */
function detectClaudeContext(path: string): boolean {
  const patterns = [
    /\.claude-plugin\//,
    /\.claude\/skills\//,
    /\/\.claude\/skills\//,
  ];
  return patterns.some((p) => p.test(path));
}

/**
 * Validates SKILL.md content against the Agent Skills specification.
 * @param content - Full SKILL.md file content
 * @param filePath - Path to the file (used for context detection)
 * @returns Validation result with errors, warnings, and parsed frontmatter
 */
function validate(content: string, filePath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    frontmatter: null,
  };

  const { yaml, lineCount } = extractFrontmatter(content);

  // Check for YAML syntax
  if (yaml === null) {
    result.valid = false;
    result.errors.push(
      "Missing or invalid frontmatter. SKILL.md must start with --- and have closing ---"
    );
    return result;
  }

  // Check for tabs (YAML requires spaces)
  if (yaml.includes("\t")) {
    result.valid = false;
    result.errors.push(
      "YAML contains tabs. Use spaces for indentation (YAML specification requirement)"
    );
  }

  // Parse YAML
  let frontmatter: SkillFrontmatter;
  try {
    frontmatter = parseYaml(yaml) as SkillFrontmatter;
    result.frontmatter = frontmatter;
  } catch (e) {
    result.valid = false;
    result.errors.push(
      `YAML parse error: ${e instanceof Error ? e.message : String(e)}`
    );
    return result;
  }

  if (!frontmatter || typeof frontmatter !== "object") {
    result.valid = false;
    result.errors.push("Frontmatter must be a YAML object");
    return result;
  }

  // Required fields (from spec)
  for (const field of spec.requiredFields) {
    if (!frontmatter[field]) {
      result.valid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  }

  // Name validation
  if (frontmatter.name) {
    const name = frontmatter.name;

    // Pattern check
    if (!spec.namePattern.test(name)) {
      result.valid = false;
      result.errors.push(
        `Invalid name format: '${name}'. Must be lowercase, numbers, hyphens only. Pattern: ${spec.namePattern}`
      );
    }

    // Length check
    if (name.length < spec.nameMinLength || name.length > spec.nameMaxLength) {
      result.valid = false;
      result.errors.push(
        `Name length must be ${spec.nameMinLength}-${spec.nameMaxLength} characters. Got: ${name.length}`
      );
    }

    // Reserved words
    for (const reserved of spec.reservedWords) {
      if (name.toLowerCase().includes(reserved)) {
        result.valid = false;
        result.errors.push(
          `Name cannot contain reserved word: '${reserved}'. Found in: '${name}'`
        );
      }
    }

    // Directory match (if file path provided)
    if (filePath && filePath !== "--stdin") {
      const parentDir = basename(dirname(filePath));
      if (parentDir !== name && parentDir !== "skills") {
        result.warnings.push(
          `Name '${name}' does not match parent directory '${parentDir}'. Consider renaming for consistency.`
        );
      }
    }
  }

  // Description validation
  if (frontmatter.description) {
    const desc = frontmatter.description;

    if (desc.length < spec.minDescriptionLength) {
      result.valid = false;
      result.errors.push(
        `Description too short: ${desc.length} chars. Minimum: ${spec.minDescriptionLength}`
      );
    }

    if (desc.length > spec.maxDescriptionLength) {
      result.valid = false;
      result.errors.push(
        `Description too long: ${desc.length} chars. Maximum: ${spec.maxDescriptionLength}`
      );
    }

    // Quality warnings
    const hasWhat =
      /\b(extracts?|process(es)?|creates?|generates?|validates?|manages?|handles?|analyzes?|reviews?|debugs?|implements?)\b/i.test(
        desc
      );
    const hasWhen =
      /\b(use when|when working|when the user|when you need)\b/i.test(desc);

    if (!hasWhat) {
      result.warnings.push(
        "Description should include WHAT the skill does (verbs like 'extracts', 'processes', 'creates')"
      );
    }

    if (!hasWhen) {
      result.warnings.push(
        "Description should include WHEN to use it (e.g., 'Use when working with...')"
      );
    }

    // Check that description is wrapped in double quotes in raw YAML
    if (!isDescriptionQuoted(yaml)) {
      result.warnings.push(
        "Description should be wrapped in double quotes for cross-platform compatibility (Codex requires quoted strings)"
      );
    }
  }

  // Check allowed-tools uses comma separation
  const allowedToolsCheck = isAllowedToolsCommaSeparated(yaml);
  if (allowedToolsCheck.present && !allowedToolsCheck.valid) {
    result.warnings.push(
      "allowed-tools should use comma separation (e.g., 'Read, Write, Edit'). Space-separated lists are not supported by all platforms (Codex requires commas)."
    );
  }

  // Check for custom fields at top level (should be under metadata)
  const allKnownFields = new Set([...BASE_FIELDS, ...CLAUDE_FIELDS]);
  for (const key of Object.keys(frontmatter)) {
    if (!allKnownFields.has(key)) {
      result.warnings.push(
        `Custom field '${key}' should be nested under 'metadata'. Top-level custom fields may cause parsing issues.`
      );
    }
  }

  // Line count warning
  if (lineCount > spec.maxLines) {
    result.warnings.push(
      `SKILL.md has ${lineCount} lines (recommended max: ${spec.maxLines}). Consider moving details to references/.`
    );
  }

  // Claude context recommendations (from spec)
  const isClaudeContext = detectClaudeContext(filePath);
  if (isClaudeContext) {
    for (const field of spec.claudeRecommendedFields) {
      if (!frontmatter[field]) {
        result.warnings.push(
          `Claude context detected. Consider adding '${field}' for tool permissions.`
        );
      }
    }
  }

  return result;
}

/**
 * Formats validation result for human-readable console output.
 * @param result - Validation result to format
 * @param path - Original file path for display
 */
function formatOutput(result: ValidationResult, path: string): void {
  const status = result.valid
    ? result.warnings.length > 0
      ? "WARNINGS"
      : "PASS"
    : "FAIL";

  console.log(`# Skill Validation: ${basename(dirname(path))}`);
  console.log(`**Status**: ${status}`);
  console.log(
    `**Issues**: ${result.errors.length} errors, ${result.warnings.length} warnings`
  );

  if (result.errors.length > 0) {
    console.log("\n## Errors (must fix)");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\n## Warnings (should fix)");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("\n✓ All checks passed");
  }
}

/**
 * Hook input from Claude Code PreToolUse
 */
interface HookInput {
  tool_name: string;
  tool_input: {
    file_path: string;
    content?: string; // Write tool
    old_string?: string; // Edit tool
    new_string?: string; // Edit tool
  };
}

/**
 * Quick check: does this string look like it might affect frontmatter?
 * Used to bail out fast on Edit operations that don't touch frontmatter.
 */
function mightAffectFrontmatter(str: string): boolean {
  // Contains frontmatter delimiter
  if (str.includes("---")) return true;
  // Contains YAML-like key: value pattern
  if (/^[a-z][-a-z]*:/m.test(str)) return true;
  return false;
}

/**
 * Read JSON from stdin with timeout protection
 */
async function readStdin(timeoutMs = 5000): Promise<string> {
  const chunks: Buffer[] = [];

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("stdin timeout")), timeoutMs);
  });

  const read = (async () => {
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  })();

  return Promise.race([read, timeout]);
}

async function main() {
  const args = process.argv.slice(2);

  // CLI mode for manual testing
  if (args.length > 0 && !args[0].startsWith("{")) {
    if (args[0] === "--help" || args[0] === "-h") {
      console.log(`Usage: validate-skill-frontmatter.ts [file]

PreToolUse hook for SKILL.md frontmatter validation.

Hook mode (default): Reads JSON from stdin
CLI mode: Pass file path as argument for manual testing

Exit codes:
  0 - Valid/skip (proceed)
  2 - Block (errors)
`);
      process.exit(0);
    }

    // Manual file validation
    const filePath = args[0];
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (_e) {
      console.error(`Error reading file: ${filePath}`);
      process.exit(2);
    }

    const result = validate(content, filePath);
    formatOutput(result, filePath);
    process.exit(result.valid ? 0 : 2);
  }

  // Hook mode: read JSON from stdin
  let input: HookInput;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw);
  } catch (_e) {
    // Can't parse input → don't block, exit cleanly
    process.exit(0);
  }

  const { tool_name, tool_input } = input;
  const filePath = tool_input?.file_path ?? "";

  // Fast bailout: Edit that doesn't touch frontmatter
  if (tool_name === "Edit") {
    const oldStr = tool_input.old_string ?? "";
    const newStr = tool_input.new_string ?? "";

    if (!(mightAffectFrontmatter(oldStr) || mightAffectFrontmatter(newStr))) {
      // Edit doesn't touch frontmatter area → skip validation
      process.exit(0);
    }

    // For Edit, we need current file + apply changes to validate
    // Read current file, apply edit, validate result
    let currentContent: string;
    try {
      currentContent = readFileSync(filePath, "utf-8");
    } catch {
      // File doesn't exist yet or can't read → skip
      process.exit(0);
    }

    // Apply the edit
    if (!currentContent.includes(oldStr)) {
      // old_string not found → Claude will error anyway, don't block
      process.exit(0);
    }

    const newContent = currentContent.replace(oldStr, newStr);
    const result = validate(newContent, filePath);

    if (!result.valid) {
      formatOutput(result, filePath);
      process.exit(2);
    }
    process.exit(0);
  }

  // Write tool: validate the new content directly
  if (tool_name === "Write") {
    const content = tool_input.content ?? "";

    if (!content.trim()) {
      // Empty content → don't block
      process.exit(0);
    }

    const result = validate(content, filePath);

    if (!result.valid) {
      formatOutput(result, filePath);
      process.exit(2);
    }
    process.exit(0);
  }

  // Unknown tool → don't block
  process.exit(0);
}

main();
