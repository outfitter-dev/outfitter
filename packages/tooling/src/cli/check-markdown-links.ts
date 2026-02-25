#!/usr/bin/env bun

/**
 * Check-markdown-links command -- validates that relative links in markdown
 * files resolve to existing files on disk.
 *
 * Exports pure functions for extraction and validation so they can be tested
 * directly. The CLI runner in {@link main} handles discovery and output.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A relative link extracted from a markdown file. */
export interface MarkdownLink {
  /** The link target path (anchors stripped). */
  readonly target: string;
  /** 1-based line number where the link appears. */
  readonly line: number;
}

/** A broken link with its source file context. */
export interface BrokenLink {
  /** Relative path of the source markdown file. */
  readonly source: string;
  /** The link target that could not be resolved. */
  readonly target: string;
  /** 1-based line number in the source file. */
  readonly line: number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Matches markdown links: [text](target) */
const MD_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** Protocols to skip (external, mailto, data, tel). */
const SKIP_PROTOCOLS = /^(https?:\/\/|mailto:|data:|tel:)/;

/** Code fence opening/closing. */
const FENCE_RE = /^(\s*)((`{3,})|~{3,})(.*)$/;

function stripInlineCodeSpans(line: string): string {
  let result = "";
  let index = 0;

  while (index < line.length) {
    if (line[index] !== "`") {
      result += line[index];
      index += 1;
      continue;
    }

    let tickCount = 1;
    while (line[index + tickCount] === "`") {
      tickCount += 1;
    }

    const opener = line.slice(index, index + tickCount);
    index += tickCount;

    let closingIndex = -1;
    let cursor = index;
    while (cursor < line.length) {
      if (line[cursor] !== "`") {
        cursor += 1;
        continue;
      }

      let runLength = 1;
      while (line[cursor + runLength] === "`") {
        runLength += 1;
      }

      if (runLength === tickCount) {
        closingIndex = cursor;
        break;
      }

      cursor += runLength;
    }

    if (closingIndex === -1) {
      // Unmatched backticks are treated as literal text.
      result += opener;
      continue;
    }

    index = closingIndex + tickCount;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Extract relative markdown links from content, skipping external URLs,
 * bare anchors, code fences, and inline code.
 *
 * @param content - Raw markdown content
 * @returns Array of extracted links with line numbers
 */
export function extractMarkdownLinks(content: string): MarkdownLink[] {
  const lines = content.split("\n");
  const links: MarkdownLink[] = [];

  let inCodeFence = false;
  let fenceChar = "";
  let fenceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const trimmed = line.trim();

    // Track code fences
    const fenceMatch = FENCE_RE.exec(trimmed);
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

    // Strip inline code before extracting links
    const stripped = stripInlineCodeSpans(line);

    for (const match of stripped.matchAll(MD_LINK_RE)) {
      let target = match[2] as string;

      // Skip external URLs and special protocols
      if (SKIP_PROTOCOLS.test(target)) continue;

      // Skip bare anchor links
      if (target.startsWith("#")) continue;

      // Strip anchor from target
      const hashIndex = target.indexOf("#");
      if (hashIndex !== -1) {
        target = target.substring(0, hashIndex);
      }

      // Skip if stripping anchor left an empty string
      if (target === "") continue;

      links.push({ target, line: i + 1 });
    }
  }

  return links;
}

/**
 * Validate that relative links in the given markdown files resolve to
 * existing files on disk.
 *
 * @param rootDir - Absolute path to the project root
 * @param files - Relative file paths (from rootDir) to check
 * @returns Array of broken links
 */
export async function validateLinks(
  rootDir: string,
  files: readonly string[]
): Promise<BrokenLink[]> {
  const broken: BrokenLink[] = [];

  for (const file of files) {
    const absolutePath = resolve(rootDir, file);
    const content = await Bun.file(absolutePath).text();
    const links = extractMarkdownLinks(content);
    const fileDir = dirname(absolutePath);

    for (const link of links) {
      // Skip links into docs/packages/ (gitignored generated mirrors)
      if (
        link.target.startsWith("docs/packages/") ||
        link.target.startsWith("./docs/packages/") ||
        link.target.startsWith("../docs/packages/")
      ) {
        continue;
      }

      // Also check resolved path for docs/packages/
      const resolvedTarget = resolve(fileDir, link.target);
      const relativeFromRoot = resolvedTarget.substring(rootDir.length + 1);
      if (relativeFromRoot.startsWith("docs/packages/")) {
        continue;
      }

      if (!existsSync(resolvedTarget)) {
        broken.push({
          source: file,
          target: link.target,
          line: link.line,
        });
      }
    }
  }

  return broken;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Default glob patterns to scan for markdown files. */
const DEFAULT_PATTERNS = [
  "docs/**/*.md",
  "packages/*/README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  ".claude/CLAUDE.md",
];

/**
 * Discover markdown files matching the given glob patterns.
 *
 * @param rootDir - Absolute path to the project root
 * @param patterns - Glob patterns to match
 * @returns Sorted array of relative file paths
 */
async function discoverFiles(
  rootDir: string,
  patterns: readonly string[]
): Promise<string[]> {
  const files = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const match of glob.scan({ cwd: rootDir, absolute: false })) {
      files.add(match);
    }
  }

  return [...files].toSorted();
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run check-markdown-links across the project.
 *
 * @param rootDir - Project root directory
 * @param patterns - Glob patterns for file discovery (defaults to standard set)
 * @returns Exit code (0 = all valid, 1 = broken links found)
 */
export async function runCheckMarkdownLinks(
  rootDir: string,
  patterns?: readonly string[]
): Promise<number> {
  const effectivePatterns = patterns ?? DEFAULT_PATTERNS;
  const files = await discoverFiles(rootDir, effectivePatterns);

  if (files.length === 0) {
    process.stdout.write("No markdown files found.\n");
    return 0;
  }

  const broken = await validateLinks(rootDir, files);

  if (broken.length === 0) {
    process.stdout.write(
      `${COLORS.green}All links valid across ${files.length} markdown file(s).${COLORS.reset}\n`
    );
    return 0;
  }

  // Group by source file
  const bySource = new Map<string, BrokenLink[]>();
  for (const link of broken) {
    const existing = bySource.get(link.source);
    if (existing) {
      existing.push(link);
    } else {
      bySource.set(link.source, [link]);
    }
  }

  process.stderr.write(
    `${COLORS.red}Found ${broken.length} broken link(s):${COLORS.reset}\n\n`
  );

  for (const [source, links] of bySource) {
    process.stderr.write(`  ${COLORS.yellow}${source}${COLORS.reset}\n`);
    for (const link of links) {
      process.stderr.write(
        `    ${COLORS.cyan}${link.line}${COLORS.reset}  ${COLORS.dim}${link.target}${COLORS.reset}\n`
      );
    }
    process.stderr.write("\n");
  }

  return 1;
}

// ---------------------------------------------------------------------------
// Main (CLI entrypoint)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`Usage: check-markdown-links [dirs/patterns...]

Validates that relative links in markdown files resolve to existing files.

Arguments:
  dirs/patterns  Glob patterns to scan (defaults: docs/, packages/*/README.md, etc.)

Options:
  --help  Show this help message

Exit codes:
  0  All links valid
  1  Broken links found
`);
    process.exit(0);
  }

  const cwd = process.cwd();
  const patterns =
    args.length > 0 ? args.filter((a) => !a.startsWith("--")) : undefined;

  const exitCode = await runCheckMarkdownLinks(cwd, patterns);
  process.exit(exitCode);
}

if (import.meta.main) {
  main();
}
