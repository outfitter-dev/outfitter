import { afterEach, describe, expect, it } from "bun:test";

import { generateDocsMap } from "../core/docs-map-generator.js";
import {
  cleanupTempRoots,
  createTrackedWorkspaceRoot,
  writeWorkspaceFiles,
} from "./docs-map-test-helpers.js";

describe("mdx output path normalization", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(roots);
  });

  it("normalizes .mdx source files to .md output paths", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-mdx-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/mdx-pkg/package.json": JSON.stringify({
        name: "@acme/mdx-pkg",
        version: "0.0.1",
      }),
      "packages/mdx-pkg/README.mdx": "# MDX Readme\n\nContent.\n",
      "packages/mdx-pkg/docs/guide.mdx": "# MDX Guide\n\nGuide content.\n",
    });

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const mdxEntries = result.value.entries.filter(
      (entry) => entry.package === "mdx-pkg"
    );
    expect(mdxEntries.length).toBe(2);

    for (const entry of mdxEntries) {
      expect(entry.sourcePath).toMatch(/\.mdx$/);
      expect(entry.outputPath).toMatch(/\.md$/);
      expect(entry.outputPath).not.toMatch(/\.mdx$/);
    }
  });

  it("preserves .md extension in output paths", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-md-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/md-pkg/package.json": JSON.stringify({
        name: "@acme/md-pkg",
        version: "0.0.1",
      }),
      "packages/md-pkg/README.md": "# Plain MD\n\nContent.\n",
    });

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const entry = result.value.entries.find(
      (candidate) => candidate.package === "md-pkg"
    );
    expect(entry?.outputPath).toMatch(/\.md$/);
    expect(entry?.outputPath).toBe("docs/packages/md-pkg/README.md");
  });
});
