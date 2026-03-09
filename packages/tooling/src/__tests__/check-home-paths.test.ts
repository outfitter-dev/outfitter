import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  findHomePathLeaks,
  runCheckHomePaths,
  type RunCheckHomePathsOptions,
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

  test("does not flag dot-separated suffixes after the home path", () => {
    expect(findHomePathLeaks("/Users/mg.config/project", "/Users/mg")).toEqual(
      []
    );
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

  test("detects a bare home path followed by closing punctuation", () => {
    const prefix = '{"path":"';
    const lineText = `${prefix}${homedir()}"}`;

    expect(findHomePathLeaks(lineText, homedir())).toEqual([
      {
        line: 1,
        column: prefix.length + 1,
        matchedText: homedir(),
        lineText,
      },
    ]);
  });

  test("detects a home path at the end of a CRLF line", () => {
    expect(
      findHomePathLeaks(`prefix ${homedir()}\r\nnext line`, homedir())
    ).toEqual([
      {
        line: 1,
        column: 8,
        matchedText: homedir(),
        lineText: `prefix ${homedir()}`,
      },
    ]);
  });

  test("throws TypeError when RegExp lacks the global flag", () => {
    expect(() => findHomePathLeaks("some content", /\/Users\/mg/)).toThrow(
      TypeError
    );
  });

  test("accepts a RegExp with the global flag", () => {
    expect(findHomePathLeaks("path /Users/mg/dev", /\/Users\/mg/g)).toEqual([
      {
        line: 1,
        column: 6,
        matchedText: "/Users/mg",
        lineText: "path /Users/mg/dev",
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

      const result = scanFilesForHardcodedHomePaths(["notes.md"], {
        cwd: workspaceRoot,
        homeDir: "/Users/mg",
      });

      expect(result).toEqual({
        failures: [],
        leaks: [
          {
            filePath: "notes.md",
            line: 1,
            column: 16,
            matchedText: "/Users/mg",
            lineText:
              "Observed path: /Users/mg/Developer/outfitter/stack/packages/tooling",
          },
        ],
      });
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

      expect(
        scanFilesForHardcodedHomePaths(["blocked.txt", "notes.md"], {
          cwd: workspaceRoot,
          homeDir: "/Users/mg",
          readFile: (path, encoding) => {
            if (path === blockedFile) {
              throw new Error("EACCES: permission denied");
            }

            return readFileSync(path, encoding);
          },
        })
      ).toEqual({
        failures: [
          {
            filePath: "blocked.txt",
            reason: "EACCES: permission denied",
          },
        ],
        leaks: [
          {
            filePath: "notes.md",
            line: 1,
            column: 16,
            matchedText: "/Users/mg",
            lineText:
              "Observed path: /Users/mg/Developer/outfitter/stack/packages/tooling",
          },
        ],
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("silently skips files that do not exist (ENOENT)", () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));

    try {
      expect(
        scanFilesForHardcodedHomePaths(["missing.md"], {
          cwd: workspaceRoot,
          homeDir: "/Users/mg",
        })
      ).toEqual({
        failures: [],
        leaks: [],
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});

// Synchronous-only — async callbacks would tear down workspaceRoot before resolving.
function withHomePathTestContext(
  fn: (ctx: {
    workspaceRoot: string;
    run: (
      paths: string[],
      scanOptions?: RunCheckHomePathsOptions["scanOptions"]
    ) => { exitCode: number | undefined; stderr: string };
  }) => void
): void {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-home-paths-"));

  try {
    fn({
      workspaceRoot,
      run(paths, scanOptions) {
        let exitCode: number | undefined;
        let output = "";

        const write: typeof process.stderr.write = ((chunk: unknown) => {
          output += String(chunk);
          return true;
        }) as typeof process.stderr.write;

        runCheckHomePaths(paths, {
          setExitCode: (value) => {
            exitCode = value;
          },
          stderr: { write },
          scanOptions,
        });

        return { exitCode, stderr: output };
      },
    });
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

describe("runCheckHomePaths", () => {
  test("leaves stderr empty and exits zero when no leaks are found", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const targetFile = join(workspaceRoot, "README.md");
      writeFileSync(
        targetFile,
        "Use repo-relative paths like packages/tooling/src/index.ts."
      );

      const { exitCode, stderr } = run([targetFile]);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
    });
  });

  test("writes the leak summary to stderr and exits non-zero when leaks are found", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const targetFile = join(workspaceRoot, "tsconfig.jsonc");
      const lineText = `    {"path":"${homedir()}/Developer/outfitter/stack/packages/tooling"}`;
      const expectedColumn = lineText.indexOf(homedir()) + 1;
      writeFileSync(targetFile, lineText);

      const { exitCode, stderr } = run([targetFile]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Hardcoded home directory paths detected:");
      expect(stderr).toContain(`${targetFile}:1:${expectedColumn}`);
      expect(stderr).toContain(lineText);
      expect(stderr).toContain(JSON.stringify(homedir()));
    });
  });

  test("writes the leak summary for a bare home-path value without a subpath", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const targetFile = join(workspaceRoot, "settings.json");
      const lineText = `{"path":"${homedir()}"}`;
      const expectedColumn = lineText.indexOf(homedir()) + 1;
      writeFileSync(targetFile, lineText);

      const { exitCode, stderr } = run([targetFile]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(`${targetFile}:1:${expectedColumn}`);
      expect(stderr).toContain(lineText);
      expect(stderr).toContain(JSON.stringify(homedir()));
    });
  });

  test("reports unreadable files with a clean diagnostic", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const blockedFile = join(workspaceRoot, "blocked.txt");
      const targetFile = join(workspaceRoot, "notes.md");
      writeFileSync(blockedFile, "placeholder");
      const lineText = `{"path":"${homedir()}/Developer/outfitter/stack/packages/tooling"}`;
      const expectedColumn = lineText.indexOf(homedir()) + 1;
      writeFileSync(targetFile, lineText);

      const { exitCode, stderr } = run([blockedFile, targetFile], {
        readFile: (path, encoding) => {
          if (path === blockedFile) {
            throw new Error("EACCES: permission denied");
          }
          return readFileSync(path, encoding);
        },
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "Unreadable file while scanning for hardcoded home paths:"
      );
      expect(stderr).toContain(`  ${blockedFile}: EACCES: permission denied`);
      expect(stderr).toContain("Hardcoded home directory paths detected:");
      expect(stderr).toContain(`${targetFile}:1:${expectedColumn}`);
      expect(stderr).toContain(JSON.stringify(homedir()));
      expect(stderr).toContain(
        "before committing.\n\nFix file permissions or remove the unreadable file before committing."
      );
      expect(stderr).toContain("Fix file permissions");
    });
  });

  test("separates failures-only guidance with a blank line", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const blockedFile = join(workspaceRoot, "blocked.txt");
      writeFileSync(blockedFile, "placeholder");

      const { exitCode, stderr } = run([blockedFile], {
        readFile: () => {
          throw new Error("EACCES: permission denied");
        },
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "Unreadable file while scanning for hardcoded home paths:"
      );
      expect(stderr).toContain(
        `  ${blockedFile}: EACCES: permission denied\n\nFix file permissions or remove the unreadable file before committing.`
      );
    });
  });

  test("pluralizes the unreadable-file guidance when multiple reads fail", () => {
    withHomePathTestContext(({ workspaceRoot, run }) => {
      const blockedFiles = [
        join(workspaceRoot, "blocked-a.txt"),
        join(workspaceRoot, "blocked-b.txt"),
      ];
      for (const blockedFile of blockedFiles) {
        writeFileSync(blockedFile, "placeholder");
      }

      const { exitCode, stderr } = run(blockedFiles, {
        readFile: () => {
          throw new Error("EACCES: permission denied");
        },
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "Unreadable files while scanning for hardcoded home paths:"
      );
      expect(stderr).toContain(
        `  ${blockedFiles[1]}: EACCES: permission denied\n\nFix file permissions or remove the unreadable files before committing.`
      );
      expect(stderr).toContain(
        "Fix file permissions or remove the unreadable files before committing."
      );
    });
  });
});
