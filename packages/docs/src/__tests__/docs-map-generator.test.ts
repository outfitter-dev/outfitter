import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateDocsMap,
  readDocsMap,
  writeDocsMap,
} from "../core/docs-map-generator.js";
import { DocsMapSchema } from "../core/docs-map-schema.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function createWorkspaceFixture(): Promise<string> {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "outfitter-docs-map-test-")
  );

  // Publishable package "alpha" with root README + docs/
  const alphaPkg = join(workspaceRoot, "packages", "alpha");
  await mkdir(join(alphaPkg, "docs"), { recursive: true });
  await writeFile(
    join(alphaPkg, "package.json"),
    JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
  );
  await writeFile(join(alphaPkg, "README.md"), "# Alpha\n\nAlpha package.\n");
  await writeFile(
    join(alphaPkg, "docs", "guide.md"),
    "# Alpha Guide\n\nA usage guide.\n"
  );
  await writeFile(
    join(alphaPkg, "docs", "notes.md"),
    "# Alpha Notes\n\nImplementation notes.\n"
  );
  await writeFile(join(alphaPkg, "CHANGELOG.md"), "# Changelog\n");

  // Publishable package "beta" with only a README
  const betaPkg = join(workspaceRoot, "packages", "beta");
  await mkdir(betaPkg, { recursive: true });
  await writeFile(
    join(betaPkg, "package.json"),
    JSON.stringify({ name: "@acme/beta", version: "0.0.1" })
  );
  await writeFile(join(betaPkg, "README.md"), "# Beta\n\nBeta package.\n");

  // Private package (should be excluded)
  const privatePkg = join(workspaceRoot, "packages", "private-pkg");
  await mkdir(privatePkg, { recursive: true });
  await writeFile(
    join(privatePkg, "package.json"),
    JSON.stringify({
      name: "@acme/private-pkg",
      private: true,
      version: "0.0.1",
    })
  );
  await writeFile(join(privatePkg, "README.md"), "# Private\n");

  // Directory without package.json (should be excluded)
  const noPkgJson = join(workspaceRoot, "packages", "no-package-json");
  await mkdir(noPkgJson, { recursive: true });
  await writeFile(join(noPkgJson, "README.md"), "# No package json\n");

  return workspaceRoot;
}

// ---------------------------------------------------------------------------
// generateDocsMap
// ---------------------------------------------------------------------------

describe("generateDocsMap", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it("produces a valid DocsMap from a workspace", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const docsMap = result.value;

    // Top-level shape validates against Zod schema
    expect(() => DocsMapSchema.parse(docsMap)).not.toThrow();

    // Generator identifier includes package name
    expect(docsMap.generator).toMatch(/^@outfitter\/docs@/);

    // Has ISO-8601 timestamp
    expect(new Date(docsMap.generatedAt).toISOString()).toBe(
      docsMap.generatedAt
    );
  });

  it("includes only publishable packages", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const packages = [
      ...new Set(
        result.value.entries
          .map((e) => e.package)
          .filter((p): p is string => p !== undefined)
      ),
    ];

    expect(packages).toContain("alpha");
    expect(packages).toContain("beta");
    expect(packages).not.toContain("private-pkg");
    expect(packages).not.toContain("no-package-json");
  });

  it("excludes CHANGELOG.md by default", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const ids = result.value.entries.map((e) => e.id);
    const hasChangelog = ids.some((id) =>
      id.toLowerCase().includes("changelog")
    );
    expect(hasChangelog).toBe(false);
  });

  it("infers readme kind for README.md", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const readmeEntries = result.value.entries.filter(
      (e) => e.kind === "readme"
    );
    expect(readmeEntries.length).toBeGreaterThanOrEqual(2); // alpha + beta
    for (const entry of readmeEntries) {
      expect(entry.sourcePath.toLowerCase()).toContain("readme.md");
    }
  });

  it("infers deep kind for files in docs/ subdirectory", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const deepEntries = result.value.entries.filter((e) => e.kind === "deep");
    expect(deepEntries.length).toBeGreaterThanOrEqual(1);
    expect(
      deepEntries.some((entry) => entry.sourcePath.includes("notes.md"))
    ).toBe(true);
  });

  it("extracts title from first heading", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const alphaReadme = result.value.entries.find(
      (e) => e.package === "alpha" && e.kind === "readme"
    );
    expect(alphaReadme?.title).toBe("Alpha");

    const alphaGuide = result.value.entries.find(
      (e) => e.package === "alpha" && e.sourcePath.endsWith("docs/guide.md")
    );
    expect(alphaGuide?.kind).toBe("guide");
    expect(alphaGuide?.title).toBe("Alpha Guide");
  });

  it("sorts entries deterministically by id", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const ids = result.value.entries.map((e) => e.id);
    const sorted = [...ids].sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual(sorted);
  });

  it("sets correct source and output paths", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const alphaReadme = result.value.entries.find(
      (e) => e.package === "alpha" && e.kind === "readme"
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

// ---------------------------------------------------------------------------
// writeDocsMap / readDocsMap roundtrip
// ---------------------------------------------------------------------------

describe("writeDocsMap / readDocsMap", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it("roundtrips a docs map through write and read", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) throw new Error(genResult.error.message);

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
    if (writeResult.isErr()) throw new Error(writeResult.error.message);

    // The written path should end with .outfitter/docs-map.json
    expect(writeResult.value).toContain(".outfitter/docs-map.json");

    const readResult = await readDocsMap({ workspaceRoot });
    expect(readResult.isOk()).toBe(true);
    if (readResult.isErr()) throw new Error(readResult.error.message);

    expect(readResult.value.generator).toBe(genResult.value.generator);
    expect(readResult.value.entries.length).toBe(
      genResult.value.entries.length
    );
    expect(readResult.value.entries).toEqual(genResult.value.entries);
  });

  it("writes valid JSON that passes Zod validation", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) throw new Error(genResult.error.message);

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
    if (writeResult.isErr()) throw new Error(writeResult.error.message);

    const raw = await readFile(writeResult.value, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    expect(() => DocsMapSchema.parse(parsed)).not.toThrow();
  });

  it("creates .outfitter/ directory if it does not exist", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-empty-test-")
    );
    roots.add(workspaceRoot);

    // Create a minimal publishable package
    const pkg = join(workspaceRoot, "packages", "minimal");
    await mkdir(pkg, { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/minimal", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.md"), "# Minimal\n");

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) throw new Error(genResult.error.message);

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
  });

  it("returns an error when docsMapDir resolves outside workspace root", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) throw new Error(genResult.error.message);

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
      docsMapDir: "../outside-map",
    });

    expect(writeResult.isErr()).toBe(true);
    if (writeResult.isOk()) {
      throw new Error("Expected writeDocsMap to fail");
    }
    expect(writeResult.error.message).toContain("docsMapDir");
  });

  it("returns error when reading from non-existent directory", async () => {
    const readResult = await readDocsMap({
      workspaceRoot: "/tmp/does-not-exist-workspace-xyz",
    });
    expect(readResult.isErr()).toBe(true);
  });

  it("returns an error when docsMapDir resolves outside workspace root during read", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

    const readResult = await readDocsMap({
      workspaceRoot,
      docsMapDir: "../outside-map",
    });

    expect(readResult.isErr()).toBe(true);
    if (readResult.isOk()) {
      throw new Error("Expected readDocsMap to fail");
    }
    expect(readResult.error.message).toContain("docsMapDir");
  });
});

// ---------------------------------------------------------------------------
// .mdx → .md output path normalization
// ---------------------------------------------------------------------------

describe("mdx output path normalization", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it("normalizes .mdx source files to .md output paths", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-mdx-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "mdx-pkg");
    await mkdir(join(pkg, "docs"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/mdx-pkg", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.mdx"), "# MDX Readme\n\nContent.\n");
    await writeFile(
      join(pkg, "docs", "guide.mdx"),
      "# MDX Guide\n\nGuide content.\n"
    );

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const mdxEntries = result.value.entries.filter(
      (e) => e.package === "mdx-pkg"
    );
    expect(mdxEntries.length).toBe(2);

    for (const entry of mdxEntries) {
      expect(entry.sourcePath).toMatch(/\.mdx$/);
      expect(entry.outputPath).toMatch(/\.md$/);
      expect(entry.outputPath).not.toMatch(/\.mdx$/);
    }
  });

  it("preserves .md extension in output paths", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-md-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "md-pkg");
    await mkdir(pkg, { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/md-pkg", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.md"), "# Plain MD\n\nContent.\n");

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const entry = result.value.entries.find((e) => e.package === "md-pkg");
    expect(entry?.outputPath).toMatch(/\.md$/);
    expect(entry?.outputPath).toBe("docs/packages/md-pkg/README.md");
  });
});

// ---------------------------------------------------------------------------
// inferDocKind (tested indirectly through generateDocsMap)
// ---------------------------------------------------------------------------

describe("doc kind inference", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it("classifies architecture docs", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-kind-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "test-pkg");
    await mkdir(join(pkg, "docs"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/test-pkg", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.md"), "# Test\n");
    await writeFile(join(pkg, "docs", "architecture.md"), "# Architecture\n");
    await writeFile(join(pkg, "docs", "conventions.md"), "# Conventions\n");

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const archEntry = result.value.entries.find((e) =>
      e.sourcePath.includes("architecture.md")
    );
    expect(archEntry?.kind).toBe("architecture");

    const conventionEntry = result.value.entries.find((e) =>
      e.sourcePath.includes("conventions.md")
    );
    expect(conventionEntry?.kind).toBe("convention");
  });

  it("classifies guide and reference docs in docs/ by filename", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-kind-guideref-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "typed-pkg");
    await mkdir(join(pkg, "docs"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/typed-pkg", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.md"), "# Typed\n");
    await writeFile(
      join(pkg, "docs", "getting-started.md"),
      "# Getting Started\n"
    );
    await writeFile(join(pkg, "docs", "api-reference.md"), "# API Reference\n");

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const guideEntry = result.value.entries.find((e) =>
      e.sourcePath.endsWith("docs/getting-started.md")
    );
    expect(guideEntry?.kind).toBe("guide");

    const referenceEntry = result.value.entries.find((e) =>
      e.sourcePath.endsWith("docs/api-reference.md")
    );
    expect(referenceEntry?.kind).toBe("reference");
  });

  it("does not classify filenames containing api as a substring as reference", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-kind-api-substring-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "substring-pkg");
    await mkdir(join(pkg, "docs"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/substring-pkg", version: "0.0.1" })
    );
    await writeFile(join(pkg, "README.md"), "# Substring\n");
    await writeFile(
      join(pkg, "docs", "rapid-deployment.md"),
      "# Rapid Deployment\n"
    );

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);

    const entry = result.value.entries.find((e) =>
      e.sourcePath.endsWith("docs/rapid-deployment.md")
    );
    expect(entry?.kind).toBe("deep");
  });
});

describe("generateDocsMap path safety", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    for (const root of roots) {
      await rm(root, { recursive: true, force: true });
    }
    roots.clear();
  });

  it("returns an error when outputDir resolves outside workspace root", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    roots.add(workspaceRoot);

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
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-map-collision-test-")
    );
    roots.add(workspaceRoot);

    const pkg = join(workspaceRoot, "packages", "collision");
    await mkdir(join(pkg, "docs"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@acme/collision", version: "0.0.1" })
    );
    await writeFile(join(pkg, "docs", "guide.md"), "# Guide md\n");
    await writeFile(join(pkg, "docs", "guide.mdx"), "# Guide mdx\n");

    const result = await generateDocsMap({ workspaceRoot });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected generateDocsMap to fail");
    }
    expect(result.error.message).toContain("output path collision");
  });
});
