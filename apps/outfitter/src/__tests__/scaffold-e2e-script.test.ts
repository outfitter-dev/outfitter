import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..", "..");
const scriptPath = join(
  repoRoot,
  "apps",
  "outfitter",
  "src",
  "scripts",
  "scaffold-e2e.ts"
);

describe("scaffold e2e script", () => {
  test("prints a friendly error for unknown arguments", async () => {
    const proc = Bun.spawn(["bun", scriptPath, "--wat"], {
      cwd: repoRoot,
      stderr: "pipe",
      stdout: "pipe",
    });

    const [exitCode, stderr, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stderr).text(),
      new Response(proc.stdout).text(),
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("[scaffold-e2e] error: Unknown argument: --wat");
    expect(stderr).not.toContain("at main");
    expect(stdout).toBe("");
  });

  test("does not mutate the workspace when preset validation fails", async () => {
    const rootDir = mkdtempSync(
      join(tmpdir(), "outfitter-scaffold-e2e-script-")
    );
    const existingRunName =
      "20000101T000000-manual-00000000-0000-7000-8000-000000000000";
    const existingRunDir = join(rootDir, existingRunName);
    mkdirSync(existingRunDir, { recursive: true });

    try {
      const proc = Bun.spawn(
        [
          "bun",
          scriptPath,
          "--root",
          rootDir,
          "--max-age-hours",
          "0",
          "--preset",
          "wat",
        ],
        {
          cwd: repoRoot,
          stderr: "pipe",
          stdout: "pipe",
        }
      );

      const [exitCode, stderr, stdout] = await Promise.all([
        proc.exited,
        new Response(proc.stderr).text(),
        new Response(proc.stdout).text(),
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain(
        "[scaffold-e2e] error: Unknown scaffold E2E preset(s): wat"
      );
      expect(stdout).toBe("");
      expect(existsSync(existingRunDir)).toBe(true);
      expect(readdirSync(rootDir).map((entry) => basename(entry))).toEqual([
        existingRunName,
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
