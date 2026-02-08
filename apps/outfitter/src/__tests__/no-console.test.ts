/**
 * Guard against direct console usage in CLI commands.
 */

import { describe, test } from "bun:test";
import { join } from "node:path";

const srcRoot = join(import.meta.dir, "..");

function stripBlockCommentsKeepLines(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, "")
  );
}

function findConsoleLines(source: string): number[] {
  const withoutBlockComments = stripBlockCommentsKeepLines(source);
  const lines = withoutBlockComments.split("\n");
  const matches: number[] = [];

  lines.forEach((line, index) => {
    const withoutLineComments = line.replace(/\/\/.*$/g, "");
    if (/\bconsole\./.test(withoutLineComments)) {
      matches.push(index + 1);
    }
  });

  return matches;
}

describe("cli commands", () => {
  test("do not use console.* directly", async () => {
    const glob = new Bun.Glob("commands/*.ts");
    const commandFiles = Array.from(glob.scanSync({ cwd: srcRoot })).map(
      (file) => join(srcRoot, file)
    );

    const files = [
      ...commandFiles,
      join(srcRoot, "actions.ts"),
      join(srcRoot, "cli.ts"),
    ];

    const failures: string[] = [];

    for (const file of files) {
      const contents = await Bun.file(file).text();
      const lines = findConsoleLines(contents);
      if (lines.length > 0) {
        failures.push(`${file}: ${lines.join(", ")}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`console usage found:\n${failures.join("\n")}`);
    }
  });
});
