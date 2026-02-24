/**
 * LLM export rendering helpers.
 *
 * @packageDocumentation
 */

import { relativeToWorkspace, toPosixPath } from "./path-utils.js";
import type { ExpectedOutput, ResolvedLlmsOptions } from "./types.js";

function trimTrailingWhitespace(value: string): string {
  return value.replace(/[ \t]+$/gm, "").trimEnd();
}

function extractFirstHeading(content: string): string | null {
  for (const line of content.split(/\r?\n/u)) {
    const headingMatch = /^\s*#{1,6}\s+(.+)$/u.exec(line);
    if (!headingMatch) {
      continue;
    }

    const heading = headingMatch.at(1);
    if (heading) {
      return heading.trim();
    }
  }

  return null;
}

function renderLlmsIndex(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string
): string {
  const lines: string[] = [
    "# llms.txt",
    "",
    "Outfitter package docs index for LLM retrieval.",
    "",
  ];

  for (const packageName of expectedOutput.packageNames) {
    lines.push(`## ${packageName}`);

    const packageEntries = expectedOutput.entries
      .filter((entry) => entry.packageName === packageName)
      .sort((a, b) =>
        toPosixPath(a.destinationAbsolutePath).localeCompare(
          toPosixPath(b.destinationAbsolutePath)
        )
      );

    for (const entry of packageEntries) {
      const relativePath = relativeToWorkspace(
        workspaceRoot,
        entry.destinationAbsolutePath
      );
      const heading = extractFirstHeading(entry.content);
      lines.push(`- ${relativePath}${heading ? ` — ${heading}` : ""}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderLlmsFull(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string
): string {
  const lines: string[] = [
    "# llms-full.txt",
    "",
    "Outfitter package docs corpus for LLM retrieval.",
    "",
  ];

  const entries = [...expectedOutput.entries].sort((a, b) =>
    toPosixPath(a.destinationAbsolutePath).localeCompare(
      toPosixPath(b.destinationAbsolutePath)
    )
  );

  for (const entry of entries) {
    const relativePath = relativeToWorkspace(
      workspaceRoot,
      entry.destinationAbsolutePath
    );
    const heading = extractFirstHeading(entry.content);

    lines.push("---");
    lines.push(`path: ${relativePath}`);
    lines.push(`package: ${entry.packageName}`);
    if (heading) {
      lines.push(`title: ${heading}`);
    }
    lines.push("---");
    lines.push("");
    lines.push(trimTrailingWhitespace(entry.content));
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function buildLlmsExpectedFiles(
  expectedOutput: ExpectedOutput,
  workspaceRoot: string,
  llmsOptions: ResolvedLlmsOptions
): Map<string, string> {
  const files = new Map<string, string>();

  for (const target of llmsOptions.targets) {
    if (target === "llms") {
      files.set(
        llmsOptions.llmsPath,
        renderLlmsIndex(expectedOutput, workspaceRoot)
      );
      continue;
    }

    files.set(
      llmsOptions.llmsFullPath,
      renderLlmsFull(expectedOutput, workspaceRoot)
    );
  }

  return files;
}
