#!/usr/bin/env bun
/**
 * lint-fences.ts
 *
 * Scans markdown files for code fence issues:
 * - Bare fences (``` without a language specifier) with content-based suggestions
 * - Broken nesting (inner/outer fences with same backtick count)
 *
 * Usage:
 *   bun lint-fences.ts <path>           # Scan a single file
 *   bun lint-fences.ts <directory>      # Scan all .md files recursively
 *   bun lint-fences.ts --help
 *
 * Exit codes:
 *   0 - No issues found
 *   1 - Issues found
 *   2 - Usage error
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, relative } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FenceFinding {
  file: string;
  line: number;
  type: "bare-fence" | "nesting";
  /** The fence marker (e.g., "```" or "````") */
  fence: string;
  /** Suggested language for bare fences */
  suggestion?: string;
  context: string;
}

export interface ScanResult {
  file: string;
  findings: FenceFinding[];
}

// ── Fence parsing ───────────────────────────────────────────────────────────

/** Match an opening or closing code fence: 3+ backticks or 3+ tildes.
 *  Per CommonMark spec, fences allow 0-3 spaces of indentation only;
 *  4+ spaces is an indented code block, not a fence. */
const FENCE_RE = /^( {0,3})((`{3,})|~{3,})(.*)$/;

function parseFenceLine(line: string): {
  indent: string;
  marker: string;
  char: string;
  count: number;
  info: string;
} | null {
  const match = FENCE_RE.exec(line);
  if (!match) return null;
  const indent = match[1] ?? "";
  const marker = match[2] ?? "";
  const char = marker[0] ?? "`";
  const info = (match[4] ?? "").trim();
  return { indent, marker, char, count: marker.length, info };
}

// ── Language heuristics ─────────────────────────────────────────────────────

const LANG_PATTERNS: [RegExp, string][] = [
  [/^\s*#!\s*\/.*\b(ba)?sh\b/, "bash"],
  [
    /^\s*(export |source |alias |eval |sudo |apt |brew |npm |bun |yarn |pnpm |cargo |docker |kubectl |curl |wget |chmod |mkdir |rm |cp |mv |ls |cd |echo |cat |grep |awk |sed |git |gt |gh )/,
    "bash",
  ],
  [/^\s*\$\s+\w/, "bash"],
  [/^\s*\{[\s\S]*"[\w-]+":\s/, "json"],
  [/^\s*\{/, "json"],
  [/^\s*\[/, "json"],
  // Python before TypeScript — `def`, `from X import`, bare `import X` are Python-specific
  [
    /^\s*(def |from \w+ import |if __name__|print\(|raise |except |try:|with |elif )/,
    "python",
  ],
  [/^\s*import \w+\s*$/, "python"],
  // TypeScript — destructured imports, type imports, other keywords
  [/^\s*import\s+[{*]/, "typescript"],
  [/^\s*import\s+type\s/, "typescript"],
  [/^\s*import\s+\w+\s+from\s/, "typescript"],
  [
    /^\s*(export|const|let|var|function|class|interface|type|enum|async|await)\s/,
    "typescript",
  ],
  [/:\s*(string|number|boolean|void|any|unknown|never)\b/, "typescript"],
  [/=>\s*\{/, "typescript"],
  [/^\s*---\n\w+:/, "yaml"],
  [/^\s*\w[\w-]*:\s/, "yaml"],
  [/^\s*<\w+[ />]/, "html"],
  [/^\s*#\s+\w/, "markdown"],
  [
    /^\s*(CREATE |SELECT |INSERT |UPDATE |DELETE |ALTER |DROP |FROM |WHERE )/i,
    "sql",
  ],
  [
    /^\s*(fn |let |mut |use |pub |impl |struct |enum |mod |crate|match )\b/,
    "rust",
  ],
  [/^\s*(func |package |import |var |type |go |chan |defer )\b/, "go"],
  [/^\s*\/\/\s/, "text"],
];

function guessLanguage(blockContent: string): string {
  const lines = blockContent.split("\n").slice(0, 5);
  for (const line of lines) {
    for (const [pattern, lang] of LANG_PATTERNS) {
      if (pattern.test(line)) return lang;
    }
  }
  return "text";
}

// ── Scanner ─────────────────────────────────────────────────────────────────

export function scanFences(filePath: string, content: string): ScanResult {
  const lines = content.split("\n");
  const findings: FenceFinding[] = [];

  let inFrontmatter = false;
  let frontmatterDone = false;
  let inComment = false;

  // Fence tracking state
  let currentFence: {
    char: string;
    count: number;
    line: number;
    lang: string;
  } | null = null;
  let blockContent: string[] = [];

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

    // Track HTML comments
    if (!currentFence && line.includes("<!--")) inComment = true;
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }

    const fence = parseFenceLine(line);
    if (!fence) {
      if (currentFence) blockContent.push(line);
      continue;
    }

    if (!currentFence) {
      // Opening fence
      currentFence = {
        char: fence.char,
        count: fence.count,
        line: i + 1,
        lang: fence.info.split(/\s/)[0] ?? "",
      };
      blockContent = [];

      if (!currentFence.lang) {
        // We'll add the finding after we collect block content for suggestion
      }
    } else if (
      fence.char === currentFence.char &&
      fence.count >= currentFence.count &&
      !fence.info
    ) {
      // Closing fence — same char, same or more backticks, no info string
      if (!currentFence.lang) {
        const suggestion = guessLanguage(blockContent.join("\n"));
        findings.push({
          file: filePath,
          line: currentFence.line,
          type: "bare-fence",
          fence: currentFence.char.repeat(currentFence.count),
          suggestion,
          context: lines[currentFence.line - 1]?.trim() ?? "",
        });
      }
      currentFence = null;
      blockContent = [];
    } else if (currentFence) {
      // Line looks like a fence but doesn't close the current one.
      // If it's the same char and same count with an info string,
      // that's a nesting violation (inner fence can't be distinguished from outer).
      if (
        fence.char === currentFence.char &&
        fence.count === currentFence.count &&
        fence.info
      ) {
        findings.push({
          file: filePath,
          line: i + 1,
          type: "nesting",
          fence: fence.char.repeat(fence.count),
          context: trimmed,
        });
      }
      blockContent.push(line);
    }
  }

  return { file: filePath, findings };
}

function scanFile(filePath: string): ScanResult {
  const content = readFileSync(filePath, "utf-8");
  return scanFences(filePath, content);
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
const YELLOW = "\x1b[1;33m";
const CYAN = "\x1b[0;36m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

function formatResults(results: ScanResult[], basePath: string): string {
  const lines: string[] = [];
  let totalFindings = 0;
  let bareCount = 0;
  let nestingCount = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;
    totalFindings += result.findings.length;

    const relPath = relative(basePath, result.file);
    lines.push(`\n${RED}${relPath}${NC}`);

    for (const finding of result.findings) {
      if (finding.type === "bare-fence") {
        bareCount++;
        const suggest = finding.suggestion
          ? ` ${YELLOW}→ ${finding.fence}${finding.suggestion}${NC}`
          : "";
        lines.push(
          `  ${CYAN}${finding.line}${NC}  bare fence: ${DIM}${finding.fence}${NC}${suggest}`
        );
      } else {
        nestingCount++;
        lines.push(
          `  ${CYAN}${finding.line}${NC}  nesting: ${DIM}${finding.context}${NC}`
        );
      }
    }
  }

  lines.push("");
  if (totalFindings > 0) {
    const parts: string[] = [];
    if (bareCount > 0) parts.push(`${bareCount} bare fence(s)`);
    if (nestingCount > 0) parts.push(`${nestingCount} nesting issue(s)`);
    lines.push(
      `${RED}Found ${parts.join(", ")} in ${results.filter((r) => r.findings.length > 0).length} file(s)${NC}`
    );
  } else {
    lines.push(`${GREEN}No code fence issues found${NC}`);
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
    console.log(`Usage: lint-fences.ts <path>

Scans markdown files for code fence issues:
- Bare fences without language specifiers
- Broken nesting (same backtick count at different depths)

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
            fence: f.fence,
            ...(f.suggestion ? { suggestion: f.suggestion } : {}),
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
