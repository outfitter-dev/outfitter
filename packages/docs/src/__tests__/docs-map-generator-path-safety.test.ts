import { afterEach, describe, expect, it } from "bun:test";

import { generateDocsMap } from "../core/docs-map-generator.js";
import {
  cleanupTempRoots,
  createDocsMapGeneratorWorkspaceFixture,
  createTrackedWorkspaceRoot,
  writeWorkspaceFiles,
} from "./docs-map-test-helpers.js";

describe("generateDocsMap path safety", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(roots);
  });

  it("returns an error when outputDir resolves outside workspace root", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({
      workspaceRoot,
      outputDir: "../outside-docs",
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected generateDocsMap to fail");
    }
    expect(result.error.message).toContain("outputDir");
  });

  it("returns an error when .md and .mdx sources collide on output path", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-collision-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/collision/package.json": JSON.stringify({
        name: "@acme/collision",
        version: "0.0.1",
      }),
      "packages/collision/docs/guide.md": "# Guide md\n",
      "packages/collision/docs/guide.mdx": "# Guide mdx\n",
    });

    const result = await generateDocsMap({ workspaceRoot });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected generateDocsMap to fail");
    }
    expect(result.error.message).toContain("output path collision");
  });
});
