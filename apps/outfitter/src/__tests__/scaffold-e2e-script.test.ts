import { describe, expect, test } from "bun:test";
import { join } from "node:path";

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
});
