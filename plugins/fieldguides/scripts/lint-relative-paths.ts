#!/usr/bin/env bun
/**
 * lint-relative-paths.ts
 *
 * Scans markdown files for relative `../` path references that should use
 * `${CLAUDE_PLUGIN_ROOT}` or skill-name references instead.
 *
 * Usage:
 *   bun lint-relative-paths.ts <path>           # Scan a single file
 *   bun lint-relative-paths.ts <directory>      # Scan all .md files recursively
 *   bun lint-relative-paths.ts --help
 *
 * Exit codes:
 *   0 - No issues found
 *   1 - Issues found
 *   2 - Usage error
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, relative } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RelativePathFinding {
  context: string;
  file: string;
  line: number;
  /** The relative path found */
  path: string;
  type: "markdown-link" | "bare-path";
}

export interface ScanResult {
  file: string;
  findings: RelativePathFinding[];
}

// ── Patterns ────────────────────────────────────────────────────────────────

/** Markdown link with ../ in the target: [text](../path) */
const MD_LINK_RE = /\[([^\]]*)\]\((\.\.\/.+?)\)/g;

/** Bare ../path reference (not in inline code, not in a link) */
const BARE_PATH_RE = /(?<![`(])(\.\.\/([\w./-]+))/g;

/** Code fence opening/closing */
const FENCE_RE = /^(\s*)((`{3,})|~{3,})(.*)$/;

// ── Scanner ─────────────────────────────────────────────────────────────────

export function scanRelativePaths(
  filePath: string,
  content: string
): ScanResult {
  const lines = content.split("\n");
  const findings: RelativePathFinding[] = [];

  let inFrontmatter = false;
  let frontmatterDone = false;
  let inComment = false;
  let inCodeFence = false;
  let fenceChar = "";
  let fenceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i] as string;
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

    // Track HTML comments — strip inline comments but skip multi-line blocks
    if (!inCodeFence && line.includes("<!--")) {
      if (line.includes("-->")) {
        // Inline comment: strip it but keep scanning the rest of the line
        line = line.replace(/<!--.*?-->/g, "");
        if (!line.trim()) continue;
      } else {
        inComment = true;
        continue;
      }
    }
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }

    // Track code fences
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2] ?? "";
      const char = marker[0] ?? "`";
      const count = marker.length;

      if (!inCodeFence) {
        inCodeFence = true;
        fenceChar = char;
        fenceCount = count;
        continue;
      }
      if (
        char === fenceChar &&
        count >= fenceCount &&
        !(fenceMatch[4] ?? "").trim()
      ) {
        inCodeFence = false;
        continue;
      }
    }
    if (inCodeFence) continue;

    // Markdown links: [text](../path)
    for (const match of line.matchAll(MD_LINK_RE)) {
      const path = match[2]!;
      findings.push({
        file: filePath,
        line: i + 1,
        type: "markdown-link",
        path,
        context: trimmed,
      });
    }

    // Bare paths: ../path (not in inline code, not already caught as link)
    // Strip out markdown links and inline code first to avoid double-counting
    const stripped = line
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "") // remove markdown links
      .replace(/`[^`]+`/g, ""); // remove inline code

    for (const match of stripped.matchAll(BARE_PATH_RE)) {
      const path = match[1]!;
      findings.push({
        file: filePath,
        line: i + 1,
        type: "bare-path",
        path,
        context: trimmed,
      });
    }
  }

  return { file: filePath, findings };
}

function scanFile(filePath: string): ScanResult {
  const content = readFileSync(filePath, "utf-8");
  return scanRelativePaths(filePath, content);
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
  return files.toSorted();
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

  for (const result of results) {
    if (result.findings.length === 0) continue;
    totalFindings += result.findings.length;

    const relPath = relative(basePath, result.file);
    lines.push(`\n${RED}${relPath}${NC}`);

    for (const finding of result.findings) {
      const typeLabel = finding.type === "markdown-link" ? "link" : "bare";
      lines.push(
        `  ${CYAN}${finding.line}${NC}  ${typeLabel}: ${DIM}${finding.path}${NC}`
      );
    }
  }

  lines.push("");
  if (totalFindings > 0) {
    const filesWithIssues = results.filter((r) => r.findings.length > 0).length;
    lines.push(
      `${RED}Found ${totalFindings} relative path(s) in ${filesWithIssues} file(s)${NC}`
    );
    lines.push(
      `${YELLOW}Use \${CLAUDE_PLUGIN_ROOT}/... instead of ../ for portable paths${NC}`
    );
  } else {
    lines.push(`${GREEN}No relative path issues found${NC}`);
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
    console.log(`Usage: lint-relative-paths.ts <path>

Scans markdown files for relative ../ path references that should use
\${CLAUDE_PLUGIN_ROOT} or skill-name references instead.

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
            type: f.type,
            path: f.path,
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

// Only run main when executed directly (not imported for tests)
if (import.meta.main) {
  main();
}
