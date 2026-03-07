import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  findHomePathLeaks,
  HomePathScanReadError,
  runCheckHomePaths,
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

  test("does not flag a different user whose username starts with the current username", () => {
    expect(
      findHomePathLeaks("/Users/johnsmith/project", "/Users/john")
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

  test("continues scanning after read errors and reports both failures and leaks", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));
    const blockedFile = join(workspaceRoot, "blocked.txt");
    const targetFile = join(workspaceRoot, "notes.md");

    try {
      writeFileSync(blockedFile, "placeholder");
      writeFileSync(
        targetFile,
        "Observed path: /Users/mg/Developer/outfitter/stack/packages/tooling"
      );

      let caught: unknown;
      try {
        scanFilesForHardcodedHomePaths(["blocked.txt", "notes.md"], {
          cwd: workspaceRoot,
          homeDir: "/Users/mg",
          readFile: (path, encoding) => {
            if (path === blockedFile) {
              throw new Error("EACCES: permission denied");
            }

            return readFileSync(path, encoding);
          },
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HomePathScanReadError);
      const scanError = caught as HomePathScanReadError;
      expect(scanError.failures).toEqual([
        {
          filePath: "blocked.txt",
          reason: "EACCES: permission denied",
        },
      ]);
      expect(scanError.leaks).toEqual([
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

describe("runCheckHomePaths", () => {
  test("leaves stderr empty and exits zero when no leaks are found", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));
    const targetFile = join(workspaceRoot, "README.md");
    let capturedExitCode: number | undefined;
    let stderr = "";

    try {
      writeFileSync(
        targetFile,
        "Use repo-relative paths like packages/tooling/src/index.ts."
      );

      const captureStderr = ((chunk: unknown) => {
        stderr += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      runCheckHomePaths([targetFile], {
        setExitCode: (value) => {
          capturedExitCode = value;
        },
        stderr: { write: captureStderr },
      });

      expect(capturedExitCode).toBe(0);
      expect(stderr).toBe("");
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("writes the leak summary to stderr and exits non-zero when leaks are found", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));
    const targetFile = join(workspaceRoot, "tsconfig.jsonc");
    let capturedExitCode: number | undefined;
    let stderr = "";

    try {
      const lineText = `{"path":"${homedir()}/Developer/outfitter/stack/packages/tooling"}`;
      const expectedColumn = lineText.indexOf(homedir()) + 1;

      writeFileSync(targetFile, lineText);

      const captureStderr = ((chunk: unknown) => {
        stderr += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      runCheckHomePaths([targetFile], {
        setExitCode: (value) => {
          capturedExitCode = value;
        },
        stderr: { write: captureStderr },
      });

      expect(capturedExitCode).toBe(1);
      expect(stderr).toContain("Hardcoded home directory paths detected:");
      expect(stderr).toContain(`${targetFile}:1:${expectedColumn}`);
      expect(stderr).toContain(JSON.stringify(homedir()));
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("reports unreadable files with a clean diagnostic", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));
    const blockedFile = join(workspaceRoot, "blocked.txt");
    const targetFile = join(workspaceRoot, "notes.md");
    let capturedExitCode: number | undefined;
    let stderr = "";

    try {
      writeFileSync(blockedFile, "placeholder");
      const lineText = `{"path":"${homedir()}/Developer/outfitter/stack/packages/tooling"}`;
      const expectedColumn = lineText.indexOf(homedir()) + 1;
      writeFileSync(targetFile, lineText);

      const captureStderr = ((chunk: unknown) => {
        stderr += String(chunk);
        return true;
      }) as typeof process.stderr.write;

      runCheckHomePaths([blockedFile, targetFile], {
        setExitCode: (value) => {
          capturedExitCode = value;
        },
        stderr: { write: captureStderr },
        scanOptions: {
          readFile: (path, encoding) => {
            if (path === blockedFile) {
              throw new Error("EACCES: permission denied");
            }

            return readFileSync(path, encoding);
          },
        },
      });

      expect(capturedExitCode).toBe(1);
      expect(stderr).toContain(
        "Unreadable files while scanning for hardcoded home paths:"
      );
      expect(stderr).toContain(`  ${blockedFile}: EACCES: permission denied`);
      expect(stderr).toContain("Hardcoded home directory paths detected:");
      expect(stderr).toContain(`${targetFile}:1:${expectedColumn}`);
      expect(stderr).toContain("Fix file permissions");
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
