import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const decoder = new TextDecoder();

describe("oxlint plugin integration", () => {
  test("loads @outfitter/oxlint-plugin from tooling config", () => {
    const repoRoot = join(import.meta.dirname, "../../../..");
    const fixtureDir = join(
      repoRoot,
      "packages",
      `.tmp-oxlint-plugin-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const fixtureSource = join(fixtureDir, "src", "index.ts");
    const configPath = join(
      repoRoot,
      "packages/tooling/configs/.oxlintrc.json"
    );

    mkdirSync(join(fixtureDir, "src"), { recursive: true });
    writeFileSync(fixtureSource, "console.log('lint me');\n");

    try {
      const result = Bun.spawnSync(
        ["bun", "x", "oxlint", "--config", configPath, fixtureSource],
        {
          cwd: repoRoot,
          stderr: "pipe",
          stdout: "pipe",
        }
      );

      const output = [
        decoder.decode(result.stdout).trim(),
        decoder.decode(result.stderr).trim(),
      ]
        .filter(Boolean)
        .join("\n");

      expect(result.exitCode).not.toBe(0);
      expect(output).toMatch(
        /outfitter\(no-console-in-packages\)|outfitter\/no-console-in-packages/
      );
      expect(output).not.toContain("Failed to load JS plugin");
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
