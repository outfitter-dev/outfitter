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

export function findHomePathLeaks(
  content: string,
  homePath: string
): HomePathLeak[] {
  if (homePath.trim().length === 0) {
    return [];
  }

  const pattern = new RegExp(escapeRegExp(homePath), "g");
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
}

export async function scanFilesForHardcodedHomePaths(
  filePaths: readonly string[],
  options: ScanHomePathOptions = {}
): Promise<FileHomePathLeak[]> {
  const cwd = options.cwd ?? process.cwd();
  const homePath = options.homeDir ?? homedir();
  const leaks: FileHomePathLeak[] = [];

  for (const filePath of filePaths) {
    const absolutePath = resolve(cwd, filePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const fileLeaks = findHomePathLeaks(
      readFileSync(absolutePath, "utf-8"),
      homePath
    );
    for (const leak of fileLeaks) {
      leaks.push({
        filePath,
        ...leak,
      });
    }
  }

  return leaks;
}

export async function runCheckHomePaths(
  paths: readonly string[]
): Promise<void> {
  const leaks = await scanFilesForHardcodedHomePaths(paths);
  if (leaks.length === 0) {
    process.exitCode = 0;
    return;
  }

  process.stderr.write("Hardcoded home directory paths detected:\n");
  for (const leak of leaks) {
    process.stderr.write(
      `  ${leak.filePath}:${leak.line}:${leak.column} ${leak.lineText.trim()}\n`
    );
  }
  process.stderr.write(
    `\nReplace ${JSON.stringify(homedir())} with a repo-relative or home-agnostic path before committing.\n`
  );
  process.exitCode = 1;
}
