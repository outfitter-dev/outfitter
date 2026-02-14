import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ci template rendering", () => {
  test("buildCiWorkflowTemplate applies configurable versions", async () => {
    const { buildCiWorkflowTemplate } = await import("../cli/init.js");

    const workflow = buildCiWorkflowTemplate({
      bunVersion: "1.3.7",
      nodeVersion: "24",
    });

    expect(workflow).toContain("bun-version: 1.3.7");
    expect(workflow).toContain("node-version: 24");
  });

  test("buildReleaseWorkflowTemplate applies default branch", async () => {
    const { buildReleaseWorkflowTemplate } = await import("../cli/init.js");

    const workflow = buildReleaseWorkflowTemplate({ defaultBranch: "trunk" });

    expect(workflow).toContain("branches: [trunk]");
  });
});

describe("ci init", () => {
  test("initCi writes workflow files and ci scripts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "outfitter-ci-"));

    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "demo", scripts: {} }, null, 2)
      );

      const { initCi } = await import("../cli/init.js");
      const result = await initCi({ cwd: dir, defaultBranch: "main" });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        return;
      }

      const ciWorkflow = await readFile(
        join(dir, ".github/workflows/ci.yml"),
        "utf8"
      );
      const releaseWorkflow = await readFile(
        join(dir, ".github/workflows/release.yml"),
        "utf8"
      );
      const pkg = JSON.parse(
        await readFile(join(dir, "package.json"), "utf8")
      ) as {
        scripts: Record<string, string>;
      };

      expect(ciWorkflow).toContain("name: CI");
      expect(releaseWorkflow).toContain("name: Release");
      expect(pkg.scripts["ci:check"]).toBe("bun run check");
      expect(pkg.scripts["ci:build"]).toBe("bun run build");
      expect(pkg.scripts["ci:test"]).toBe("bun run test");
      expect(result.value.writtenFiles.length).toBeGreaterThanOrEqual(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
