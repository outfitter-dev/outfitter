import { afterEach, describe, expect, it } from "bun:test";

import { generateDocsMap } from "../core/docs-map-generator.js";
import { DocsMapSchema } from "../core/docs-map-schema.js";
import {
  cleanupTempRoots,
  createDocsMapGeneratorWorkspaceFixture,
} from "./docs-map-test-helpers.js";

describe("generateDocsMap", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(roots);
  });

  it("produces a valid DocsMap from a workspace", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const docsMap = result.value;

    expect(() => DocsMapSchema.parse(docsMap)).not.toThrow();
    expect(docsMap.generator).toMatch(/^@outfitter\/docs@/);
    expect(new Date(docsMap.generatedAt).toISOString()).toBe(
      docsMap.generatedAt
    );
  });

  it("includes only publishable packages", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const packages = [
      ...new Set(
        result.value.entries
          .map((entry) => entry.package)
          .filter((pkg): pkg is string => pkg !== undefined)
      ),
    ];

    expect(packages).toContain("alpha");
    expect(packages).toContain("beta");
    expect(packages).not.toContain("private-pkg");
    expect(packages).not.toContain("no-package-json");
  });

  it("excludes CHANGELOG.md by default", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const ids = result.value.entries.map((entry) => entry.id);
    const hasChangelog = ids.some((id) =>
      id.toLowerCase().includes("changelog")
    );
    expect(hasChangelog).toBe(false);
  });

  it("infers readme kind for README.md", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const readmeEntries = result.value.entries.filter(
      (entry) => entry.kind === "readme"
    );
    expect(readmeEntries.length).toBeGreaterThanOrEqual(2);
    for (const entry of readmeEntries) {
      expect(entry.sourcePath.toLowerCase()).toContain("readme.md");
    }
  });

  it("infers deep kind for files in docs/ subdirectory", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const deepEntries = result.value.entries.filter(
      (entry) => entry.kind === "deep"
    );
    expect(deepEntries.length).toBeGreaterThanOrEqual(1);
    expect(
      deepEntries.some((entry) => entry.sourcePath.includes("notes.md"))
    ).toBe(true);
  });

  it("extracts title from first heading", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const alphaReadme = result.value.entries.find(
      (entry) => entry.package === "alpha" && entry.kind === "readme"
    );
    expect(alphaReadme?.title).toBe("Alpha");

    const alphaGuide = result.value.entries.find(
      (entry) =>
        entry.package === "alpha" && entry.sourcePath.endsWith("docs/guide.md")
    );
    expect(alphaGuide?.kind).toBe("guide");
    expect(alphaGuide?.title).toBe("Alpha Guide");
  });

  it("sorts entries deterministically by id", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const ids = result.value.entries.map((entry) => entry.id);
    const sorted = [...ids].sort((left, right) => left.localeCompare(right));
    expect(ids).toEqual(sorted);
  });

  it("sets correct source and output paths", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const alphaReadme = result.value.entries.find(
      (entry) => entry.package === "alpha" && entry.kind === "readme"
    );

    expect(alphaReadme?.sourcePath).toBe("packages/alpha/README.md");
    expect(alphaReadme?.outputPath).toBe("docs/packages/alpha/README.md");
  });

  it("returns error for non-existent workspace", async () => {
    const result = await generateDocsMap({
      workspaceRoot: "/tmp/does-not-exist-workspace-xyz",
    });
    expect(result.isErr()).toBe(true);
  });
});
