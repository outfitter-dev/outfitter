import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findHomePathLeaks,
  scanFilesForHardcodedHomePaths,
} from "../cli/check-home-paths.js";

describe("findHomePathLeaks", () => {
  test("returns empty array when content does not include the current home path", () => {
    expect(
      findHomePathLeaks("See packages/contracts/src/index.ts", "/Users/mg")
    ).toEqual([]);
  });

  test("detects the current home path in evidence text", () => {
    expect(
      findHomePathLeaks(
        "Run cd /Users/mg/Developer/outfitter/stack && bun test",
        "/Users/mg"
      )
    ).toEqual([
      {
        line: 1,
        column: 8,
        matchedText: "/Users/mg",
        lineText: "Run cd /Users/mg/Developer/outfitter/stack && bun test",
      },
    ]);
  });

  test("ignores example paths for a different user", () => {
    expect(
      findHomePathLeaks('Example path: "/Users/john/Documents"', "/Users/mg")
    ).toEqual([]);
  });

  test("detects escaped Windows home paths in serialized content", () => {
    expect(
      findHomePathLeaks(
        "Path: C:\\\\Users\\\\mg\\\\Developer\\\\outfitter\\\\stack",
        "C:\\Users\\mg"
      )
    ).toEqual([
      {
        line: 1,
        column: 7,
        matchedText: "C:\\\\Users\\\\mg",
        lineText: "Path: C:\\\\Users\\\\mg\\\\Developer\\\\outfitter\\\\stack",
      },
    ]);
  });
});

describe("scanFilesForHardcodedHomePaths", () => {
  test("reports matching files with relative paths", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));
    const targetFile = join(workspaceRoot, "notes.md");

    try {
      writeFileSync(
        targetFile,
        "Observed path: /Users/mg/Developer/outfitter/stack/packages/tooling"
      );

      const leaks = scanFilesForHardcodedHomePaths(["notes.md"], {
        cwd: workspaceRoot,
        homeDir: "/Users/mg",
      });

      expect(leaks).toEqual([
        {
          filePath: "notes.md",
          line: 1,
          column: 16,
          matchedText: "/Users/mg",
          lineText:
            "Observed path: /Users/mg/Developer/outfitter/stack/packages/tooling",
        },
      ]);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
