/**
 * _shared.ts
 *
 * Shared utilities for plugin/skill validation and scaffolding scripts.
 * Extracts common patterns: ANSI colors, name validation, frontmatter parsing.
 */

// ── ANSI Colors ──────────────────────────────────────────────────────────────

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const BLUE = "\x1b[0;34m";
const CYAN = "\x1b[0;36m";
const NC = "\x1b[0m";

export function printError(msg: string): void {
  console.error(`${RED}✗ ERROR:${NC} ${msg}`);
}

export function printWarning(msg: string): void {
  console.error(`${YELLOW}⚠ WARNING:${NC} ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`${BLUE}ℹ INFO:${NC} ${msg}`);
}

export function printSuccess(msg: string): void {
  console.log(`${GREEN}✓ PASS:${NC} ${msg}`);
}

export function printStep(msg: string): void {
  console.log(`${BLUE}[STEP]${NC} ${msg}`);
}

export function printCheck(index: number, msg: string): void {
  console.log(`${CYAN}[CHECK ${index}]${NC} ${msg}`);
}

export function printHeader(title: string): void {
  const padded = title.padEnd(42);
  console.log(`${BLUE}╔════════════════════════════════════════════╗${NC}`);
  console.log(`${BLUE}║ ${padded} ║${NC}`);
  console.log(`${BLUE}╚════════════════════════════════════════════╝${NC}`);
}

// ── Name Validation ──────────────────────────────────────────────────────────

export const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const RESERVED_WORDS = ["anthropic", "claude"];

/**
 * Validates a plugin or skill name against the naming spec.
 * @returns Array of error messages (empty = valid)
 */
export function validateName(name: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push("Name cannot be empty");
    return errors;
  }

  if (!NAME_PATTERN.test(name)) {
    errors.push(
      `Invalid name format: '${name}'. Must be lowercase, numbers, hyphens only. Pattern: ${NAME_PATTERN}`
    );
  }

  if (name.length < 2 || name.length > 64) {
    errors.push(`Name length must be 2-64 characters. Got: ${name.length}`);
  }

  for (const reserved of RESERVED_WORDS) {
    if (name.toLowerCase().includes(reserved)) {
      errors.push(
        `Name cannot contain reserved word: '${reserved}'. Found in: '${name}'`
      );
    }
  }

  return errors;
}

// ── Frontmatter Extraction ───────────────────────────────────────────────────

/**
 * Extracts YAML frontmatter from markdown content.
 * @param content - Full markdown file content
 * @returns Object with extracted YAML string and total line count
 */
export function extractFrontmatter(content: string): {
  yaml: string | null;
  lineCount: number;
} {
  const lines = content.split("\n");
  const lineCount = lines.length;

  if (!lines[0]?.trim().startsWith("---")) {
    return { yaml: null, lineCount };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { yaml: null, lineCount };
  }

  const yaml = lines.slice(1, endIndex).join("\n");
  return { yaml, lineCount };
}

// ── Frontmatter Field Checks ─────────────────────────────────────────────────

/**
 * Checks if the description value is wrapped in double quotes in the raw YAML.
 * The YAML parser strips quotes, so we must check the raw string.
 */
export function isDescriptionQuoted(rawYaml: string): boolean {
  const match = rawYaml.match(/^description:\s*(.+)/m);
  if (!match?.[1]) return false;
  const value = match[1].trim();
  return value.startsWith('"') && value.endsWith('"');
}

/**
 * Checks if allowed-tools uses comma separation (correct) vs space-only separation.
 * Returns true if properly comma-separated or not present.
 */
export function isAllowedToolsCommaSeparated(rawYaml: string): {
  present: boolean;
  valid: boolean;
} {
  const match = rawYaml.match(/^allowed-tools:\s*(.+)/m);
  if (!match?.[1]) return { present: false, valid: true };
  const value = match[1].trim();
  if (value.includes(",")) return { present: true, valid: true };
  if (value.includes(" ")) return { present: true, valid: false };
  return { present: true, valid: true };
}

// ── Validation Result ────────────────────────────────────────────────────────

export interface ValidationResult {
  /** Whether the validation passes all required checks */
  valid: boolean;
  /** Blocking errors that must be fixed */
  errors: string[];
  /** Non-blocking warnings for improvement */
  warnings: string[];
}

export interface PluginValidationResult extends ValidationResult {
  /** Number of checks performed */
  checks: number;
}
