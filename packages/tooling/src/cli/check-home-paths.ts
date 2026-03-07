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

  return new RegExp(`${patternSource}(?=[/\\\\]|$)`, "g");
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
  const lines = content.split("\n");

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
  readonly homeDir?: string;
  readonly readFile?: (path: string, encoding: "utf-8") => string;
}

export interface RunCheckHomePathsOptions {
  readonly setExitCode?: (code: number) => void;
  readonly stderr?: Pick<typeof process.stderr, "write">;
  readonly scanOptions?: ScanHomePathOptions;
}

class HomePathScanReadError extends Error {
  constructor(
    readonly filePath: string,
    readonly reason: string
  ) {
    super(`Could not read ${filePath}: ${reason}`);
    this.name = "HomePathScanReadError";
  }
}

export function scanFilesForHardcodedHomePaths(
  filePaths: readonly string[],
  options: ScanHomePathOptions = {}
): FileHomePathLeak[] {
  const cwd = options.cwd ?? process.cwd();
  const homePath = options.homeDir ?? homedir();
  const readFile = options.readFile ?? readFileSync;
  const leaks: FileHomePathLeak[] = [];

  for (const filePath of filePaths) {
    const absolutePath = resolve(cwd, filePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    let fileContent: string;
    try {
      fileContent = readFile(absolutePath, "utf-8");
    } catch (error) {
      throw new HomePathScanReadError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }

    const fileLeaks = findHomePathLeaks(fileContent, homePath);
    for (const leak of fileLeaks) {
      leaks.push({
        filePath,
        ...leak,
      });
    }
  }

  return leaks;
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
  let leaks: FileHomePathLeak[];
  try {
    leaks = scanFilesForHardcodedHomePaths(paths, options.scanOptions);
  } catch (error) {
    if (error instanceof HomePathScanReadError) {
      stderr.write(`${error.message}\n`);
      stderr.write(
        "Fix file permissions or remove the unreadable path before committing.\n"
      );
      setExitCode(1);
      return;
    }

    throw error;
  }
  if (leaks.length === 0) {
    setExitCode(0);
    return;
  }

  stderr.write("Hardcoded home directory paths detected:\n");
  for (const leak of leaks) {
    stderr.write(
      `  ${leak.filePath}:${leak.line}:${leak.column} ${leak.lineText.trim()}\n`
    );
  }
  stderr.write(
    `\nReplace ${JSON.stringify(leaks[0]?.matchedText ?? homedir())} with a repo-relative or home-agnostic path before committing.\n`
  );
  setExitCode(1);
}
