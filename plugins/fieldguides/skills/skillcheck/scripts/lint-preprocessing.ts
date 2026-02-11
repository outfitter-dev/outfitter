#!/usr/bin/env bun
/**
 * lint-preprocessing.ts
 *
 * Scans SKILL.md files for !`command` patterns that will trigger
 * Claude Code's preprocessor unintentionally.
 *
 * Skills that intentionally use preprocessing should declare
 * `metadata.preprocess: true` in their frontmatter.
 *
 * Usage:
 *   bun lint-preprocessing.ts <path>           # Scan a single SKILL.md
 *   bun lint-preprocessing.ts <directory>      # Scan all SKILL.md files recursively
 *   bun lint-preprocessing.ts --help
 *
 * Exit codes:
 *   0 - No issues found
 *   1 - Issues found
 *   2 - Usage error
 */

import { readFileSync, statSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import { parse as parseYaml } from "yaml";

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
  skipped: boolean;
  skipReason?: string;
}

// ── Frontmatter Parsing ─────────────────────────────────────────────────────

function extractFrontmatter(content: string): Record<string, unknown> | null {
  const lines = content.split("\n");
  if (!lines[0]?.trim().startsWith("---")) return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;

  const yaml = lines.slice(1, endIndex).join("\n");
  try {
    return parseYaml(yaml) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasPreprocessFlag(frontmatter: Record<string, unknown>): boolean {
  const metadata = frontmatter.metadata;
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).preprocess === true;
}

// ── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Pattern 1: !`content` — bang immediately before backtick-delimited content.
 * This is the canonical preprocessing trigger.
 */
const BANG_BACKTICK = /!`[^`]+`/g;

/**
 * Pattern 2: `!` — bang inside single backticks (not double backticks).
 * The closing backtick creates !+backtick adjacency that the preprocessor
 * interprets as the start of a command. Safe variant: ``!`` (double backticks).
 */
const SINGLE_BACKTICK_BANG = /(?<!`)`!`(?!`)/g;

function scanFile(filePath: string): ScanResult {
  const content = readFileSync(filePath, "utf-8");
  const frontmatter = extractFrontmatter(content);

  // Skip files with metadata.preprocess: true
  if (frontmatter && hasPreprocessFlag(frontmatter)) {
    return {
      file: filePath,
      findings: [],
      skipped: true,
      skipReason: "metadata.preprocess: true",
    };
  }

  const lines = content.split("\n");
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for !`content` pattern
    for (const match of line.matchAll(BANG_BACKTICK)) {
      findings.push({
        file: filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        match: match[0],
        context: line.trim(),
      });
    }

    // Check for `!` pattern (not ``!``)
    for (const match of line.matchAll(SINGLE_BACKTICK_BANG)) {
      findings.push({
        file: filePath,
        line: i + 1,
        column: (match.index ?? 0) + 1,
        match: match[0],
        context: line.trim(),
      });
    }
  }

  return { file: filePath, findings, skipped: false };
}

// ── Discovery ───────────────────────────────────────────────────────────────

async function findSkillFiles(searchPath: string): Promise<string[]> {
  const stat = statSync(searchPath);

  if (stat.isFile()) {
    if (basename(searchPath) === "SKILL.md") return [searchPath];
    return [];
  }

  const glob = new Bun.Glob("**/SKILL.md");
  const files: string[] = [];
  for await (const match of glob.scan({ cwd: searchPath, absolute: true })) {
    files.push(match);
  }
  return files.sort();
}

// ── Output ──────────────────────────────────────────────────────────────────

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const CYAN = "\x1b[0;36m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

function formatResults(results: ScanResult[], basePath: string): string {
  const lines: string[] = [];
  let totalFindings = 0;
  let skippedCount = 0;
  let cleanCount = 0;

  for (const result of results) {
    if (result.skipped) {
      skippedCount++;
      continue;
    }

    if (result.findings.length === 0) {
      cleanCount++;
      continue;
    }

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

  // Summary
  lines.push("");
  if (totalFindings > 0) {
    lines.push(
      `${RED}Found ${totalFindings} preprocessing pattern(s) in ${results.filter((r) => r.findings.length > 0).length} file(s)${NC}`
    );
    lines.push(
      `${DIM}Use <bang> instead of ! in SKILL.md files, or add metadata.preprocess: true for intentional use${NC}`
    );
  } else {
    lines.push(`${GREEN}No preprocessing issues found${NC}`);
  }

  if (skippedCount > 0) {
    const skippedFiles = results
      .filter((r) => r.skipped)
      .map((r) => relative(basePath, r.file));
    lines.push(
      `${YELLOW}Skipped ${skippedCount} file(s) with metadata.preprocess: true:${NC}`
    );
    for (const f of skippedFiles) {
      lines.push(`  ${DIM}${f}${NC}`);
    }
  }

  lines.push(
    `${DIM}Scanned ${results.length} SKILL.md file(s): ${cleanCount} clean, ${skippedCount} skipped, ${results.filter((r) => r.findings.length > 0).length} with issues${NC}`
  );

  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: lint-preprocessing.ts <path>

Scans SKILL.md files for preprocessing patterns that trigger Claude Code's
preprocessor unintentionally.

Arguments:
  path    A SKILL.md file or directory to scan recursively

Options:
  --help  Show this help message
  --json  Output results as JSON

Skills with metadata.preprocess: true in frontmatter are skipped.

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

  const searchPath = pathArgs[0];

  let files: string[];
  try {
    files = await findSkillFiles(searchPath);
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
      console.log(`${YELLOW}No SKILL.md files found in ${searchPath}${NC}`);
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
      skipped: results.filter((r) => r.skipped).length,
      results: results.map((r) => ({
        file: relative(basePath, r.file),
        findings: r.findings.map((f) => ({
          line: f.line,
          column: f.column,
          match: f.match,
          context: f.context,
        })),
        skipped: r.skipped,
        skipReason: r.skipReason,
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
