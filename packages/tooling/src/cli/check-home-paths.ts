/* eslint-disable outfitter/max-file-lines -- Home-path leak detection keeps scanning, reporting, and error contracts together. */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export interface HomePathLeak {
  readonly line: number;
  readonly column: number;
  readonly matchedText: string;
  readonly lineText: string;
}

export interface FileHomePathLeak extends HomePathLeak {
  readonly filePath: string;
}

export interface HomePathScanReadFailure {
  readonly filePath: string;
  readonly reason: string;
}

function formatLeakLineText(lineText: string): string {
  return lineText.trimEnd();
}

function writeLeakSummary(
  stderr: Pick<typeof process.stderr, "write">,
  leaks: readonly FileHomePathLeak[]
): void {
  stderr.write("Hardcoded home directory paths detected:\n");
  for (const leak of leaks) {
    stderr.write(
      `  ${leak.filePath}:${leak.line}:${leak.column} ${formatLeakLineText(leak.lineText)}\n`
    );
  }
}

function writeReplacementHint(
  stderr: Pick<typeof process.stderr, "write">,
  leaks: readonly FileHomePathLeak[],
  fallbackPath: string
): void {
  stderr.write(
    `\nReplace ${JSON.stringify(leaks[0]?.matchedText ?? fallbackPath)} with a repo-relative or home-agnostic path before committing.\n`
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHomePathPattern(homePath: string): RegExp | undefined {
  if (homePath.trim().length === 0) {
    return undefined;
  }

  const patternSource = homePath
    .split(/(\\+)/)
    .map((segment) =>
      segment.includes("\\") ? "\\\\+" : escapeRegExp(segment)
    )
    .join("");

  return new RegExp(`${patternSource}(?![\\w.-])`, "g");
}

export function findHomePathLeaks(
  content: string,
  homePath: string
): HomePathLeak[] {
  const pattern = buildHomePathPattern(homePath);
  if (!pattern) {
    return [];
  }

  const leaks: HomePathLeak[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const match of line.matchAll(pattern)) {
      leaks.push({
        line: index + 1,
        column: (match.index ?? 0) + 1,
        matchedText: match[0],
        lineText: line,
      });
    }
  }

  return leaks;
}

export interface ScanHomePathOptions {
  readonly cwd?: string;
  readonly existsFile?: (path: string) => boolean;
  readonly homeDir?: string;
  readonly readFile?: (path: string, encoding: "utf-8") => string;
}

export interface RunCheckHomePathsOptions {
  readonly setExitCode?: (code: number) => void;
  readonly stderr?: Pick<typeof process.stderr, "write">;
  readonly scanOptions?: ScanHomePathOptions;
}

export interface HomePathScanResult {
  readonly leaks: readonly FileHomePathLeak[];
  readonly failures: readonly HomePathScanReadFailure[];
}

export function scanFilesForHardcodedHomePaths(
  filePaths: readonly string[],
  options: ScanHomePathOptions = {}
): HomePathScanResult {
  const cwd = options.cwd ?? process.cwd();
  const existsFile = options.existsFile ?? existsSync;
  const homePath = options.homeDir ?? homedir();
  const readFile = options.readFile ?? readFileSync;
  const leaks: FileHomePathLeak[] = [];
  const failures: HomePathScanReadFailure[] = [];

  for (const filePath of filePaths) {
    const absolutePath = resolve(cwd, filePath);
    if (!existsFile(absolutePath)) {
      continue;
    }

    let fileContent: string;
    try {
      fileContent = readFile(absolutePath, "utf-8");
    } catch (error) {
      failures.push({
        filePath,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const fileLeaks = findHomePathLeaks(fileContent, homePath);
    for (const leak of fileLeaks) {
      leaks.push({
        filePath,
        ...leak,
      });
    }
  }

  return { leaks, failures };
}

export function runCheckHomePaths(
  paths: readonly string[],
  options: RunCheckHomePathsOptions = {}
): void {
  const stderr = options.stderr ?? process.stderr;
  const setExitCode =
    options.setExitCode ??
    ((code: number) => {
      process.exitCode = code;
    });
  const configuredHomeDir = options.scanOptions?.homeDir ?? homedir();
  const { failures, leaks } = scanFilesForHardcodedHomePaths(
    paths,
    options.scanOptions
  );
  if (failures.length > 0) {
    const unreadableTarget = failures.length === 1 ? "file" : "files";
    stderr.write(
      `Unreadable ${unreadableTarget} while scanning for hardcoded home paths:\n`
    );
    for (const failure of failures) {
      stderr.write(`  ${failure.filePath}: ${failure.reason}\n`);
    }

    if (leaks.length > 0) {
      stderr.write("\n");
      writeLeakSummary(stderr, leaks);
      writeReplacementHint(stderr, leaks, configuredHomeDir);
      stderr.write("\n");
    }

    stderr.write(
      `Fix file permissions or remove the unreadable ${unreadableTarget} before committing.\n`
    );
    setExitCode(1);
    return;
  }

  if (leaks.length === 0) {
    setExitCode(0);
    return;
  }

  writeLeakSummary(stderr, leaks);
  writeReplacementHint(stderr, leaks, configuredHomeDir);
  setExitCode(1);
}
