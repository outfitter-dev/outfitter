#!/usr/bin/env bun
/**
 * lint-placeholders.ts
 *
 * Scans markdown files for [string] patterns that should use { string }
 * per the instructional prose convention in formatting.md.
 *
 * Skips markdown links, file references, checkboxes, admonitions,
 * code fences, and HTML comments.
 *
 * Usage:
 *   bun lint-placeholders.ts <path>           # Scan a single file
 *   bun lint-placeholders.ts <directory>      # Scan all .md files recursively
 *   bun lint-placeholders.ts --help
 *
 * Exit codes:
 *   0 - No issues found
 *   1 - Issues found
 *   2 - Usage error
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, relative } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

interface Finding {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

interface ScanResult {
  file: string;
  findings: Finding[];
}

// ── Patterns ────────────────────────────────────────────────────────────────

/** Common file extensions to allow as [file.ext] references */
const FILE_EXT = /\.\w{1,5}$/;

/** Checkbox patterns: [x], [ ], [-] */
const CHECKBOX = /^\s*[-*+]\s+\[[ x-]\]/i;

/** GitHub admonitions: [!NOTE], [!WARNING], etc. */
const ADMONITION = /^![A-Z]+$/;

/** All-caps token under 12 chars: [REDACTED], [TIME], [WHAT], etc. */
const CAPS_TOKEN = /^[A-Z][A-Z0-9_]{0,10}$/;

/**
 * Match [content] that is NOT followed by ( — excludes markdown links.
 * Content must be at least 3 chars to skip checkboxes [x], [ ], [-]
 * and short table tokens [Op], [Msg], etc.
 */
const BRACKET_PATTERN = /\[([^\]]{3,})\](?!\()/g;

/** Kebab-case single token — CLI arg notation: [subcommand], [file-path] */
const CLI_ARG = /^[\w][\w-]*$/;

// ── Scanner ─────────────────────────────────────────────────────────────────

function isInsideInlineCode(line: string, matchIndex: number): boolean {
  // Count backticks before the match — odd count means we're inside a code span
  let count = 0;
  for (let i = 0; i < matchIndex; i++) {
    if (line[i] === "`") count++;
  }
  if (count % 2 === 0) return false;
  // Verify there's a closing backtick after the match
  const afterMatch = line.indexOf("`", matchIndex);
  return afterMatch !== -1;
}

function scanFile(filePath: string): ScanResult {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const findings: Finding[] = [];
  let inCodeFence = false;
  let inComment = false;
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const trimmed = line.trim();

    // Track YAML frontmatter (only at start of file)
    if (!frontmatterDone && trimmed === "---") {
      if (!inFrontmatter && i === 0) {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter) {
        inFrontmatter = false;
        frontmatterDone = true;
        continue;
      }
    }
    if (inFrontmatter) continue;
    if (!frontmatterDone && i > 0) frontmatterDone = true;

    // Track code fences
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    // Track HTML comments
    if (line.includes("<!--")) inComment = true;
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }

    // Skip checkbox lines
    if (CHECKBOX.test(line)) continue;

    for (const match of line.matchAll(BRACKET_PATTERN)) {
      const inner = match[1] as string;
      const matchIdx = match.index ?? 0;

      // Skip file references: [file.ext]
      if (FILE_EXT.test(inner)) continue;

      // Skip admonitions: [!NOTE]
      if (ADMONITION.test(inner)) continue;

      // Skip all-caps tokens: [REDACTED], [TIME]
      if (CAPS_TOKEN.test(inner)) continue;

      // Skip CLI arg notation: [subcommand], [path], [file-path]
      if (CLI_ARG.test(inner)) continue;

      // Skip content inside inline code spans
      if (isInsideInlineCode(line, matchIdx)) continue;

      // Skip if followed by ] — nested brackets like [[link]]
      const afterIdx = matchIdx + match[0].length;
      if (line[afterIdx] === "]") continue;

      // Skip anchor-style references: [text][ref] or [1]: url
      if (line[afterIdx] === "[") continue;
      if (/^\[\d+\]:/.test(trimmed)) continue;

      // Skip markdown link definitions: [text]: url
      const fromMatch = line.slice(matchIdx);
      if (/^\[[^\]]+\]:\s/.test(fromMatch)) continue;

      // Skip array-like syntax: [ "a", "b" ], [1, 2, 3]
      if (inner.startsWith(" ") || inner.startsWith('"')) continue;

      // Skip code expressions: [u.id, u], [contactData, setContactData]
      if (/[.,;=(){}]/.test(inner)) continue;

      findings.push({
        file: filePath,
        line: i + 1,
        column: matchIdx + 1,
        match: match[0],
        context: trimmed,
      });
    }
  }

  return { file: filePath, findings };
}

// ── Discovery ───────────────────────────────────────────────────────────────

async function findMarkdownFiles(searchPath: string): Promise<string[]> {
  const stat = statSync(searchPath);

  if (stat.isFile()) {
    if (searchPath.endsWith(".md")) return [searchPath];
    return [];
  }

  const glob = new Bun.Glob("**/*.md");
  const files: string[] = [];
  for await (const match of glob.scan({ cwd: searchPath, absolute: true })) {
    files.push(match);
  }
  return files.sort();
}

// ── Output ──────────────────────────────────────────────────────────────────

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const CYAN = "\x1b[0;36m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

function formatResults(results: ScanResult[], basePath: string): string {
  const lines: string[] = [];
  let totalFindings = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;

    totalFindings += result.findings.length;
    const relPath = relative(basePath, result.file);
    lines.push(`\n${RED}${relPath}${NC}`);

    for (const finding of result.findings) {
      lines.push(
        `  ${CYAN}${finding.line}:${finding.column}${NC}  ${finding.match}`
      );
      lines.push(`  ${DIM}${finding.context}${NC}`);
    }
  }

  lines.push("");
  if (totalFindings > 0) {
    lines.push(
      `${RED}Found ${totalFindings} placeholder(s) in ${results.filter((r) => r.findings.length > 0).length} file(s)${NC}`
    );
    lines.push(
      `${DIM}Use { description } instead of [description] for instructional placeholders${NC}`
    );
  } else {
    lines.push(`${GREEN}No placeholder issues found${NC}`);
  }

  const filesWithIssues = results.filter((r) => r.findings.length > 0).length;
  const cleanCount = results.length - filesWithIssues;
  lines.push(
    `${DIM}Scanned ${results.length} markdown file(s): ${cleanCount} clean, ${filesWithIssues} with issues${NC}`
  );

  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: lint-placeholders.ts <path>

Scans markdown files for [string] placeholder patterns that should
use { string } per the instructional prose convention.

Arguments:
  path    A markdown file or directory to scan recursively

Options:
  --help  Show this help message
  --json  Output results as JSON

Exit codes:
  0  No issues found
  1  Issues found
  2  Usage error`);
    process.exit(0);
  }

  const jsonOutput = args.includes("--json");
  const pathArgs = args.filter((a) => !a.startsWith("--"));

  if (pathArgs.length === 0) {
    console.error("Error: path argument required. Use --help for usage.");
    process.exit(2);
  }

  const searchPath = pathArgs[0] as string;

  let files: string[];
  try {
    files = await findMarkdownFiles(searchPath);
  } catch (e) {
    console.error(
      `Error scanning path: ${e instanceof Error ? e.message : String(e)}`
    );
    process.exit(2);
  }

  if (files.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ files: 0, findings: 0, results: [] }));
    } else {
      console.log(`No markdown files found in ${searchPath}`);
    }
    process.exit(0);
  }

  const results = files.map(scanFile);

  if (jsonOutput) {
    const basePath = statSync(searchPath).isFile()
      ? dirname(searchPath)
      : searchPath;
    const output = {
      files: results.length,
      findings: results.reduce((sum, r) => sum + r.findings.length, 0),
      results: results
        .filter((r) => r.findings.length > 0)
        .map((r) => ({
          file: relative(basePath, r.file),
          findings: r.findings.map((f) => ({
            line: f.line,
            column: f.column,
            match: f.match,
            context: f.context,
          })),
        })),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatResults(results, searchPath));
  }

  const hasIssues = results.some((r) => r.findings.length > 0);
  process.exit(hasIssues ? 1 : 0);
}

main();
