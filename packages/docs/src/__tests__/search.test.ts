/**
 * Tests for `createDocsSearch` — reusable FTS5-backed search API.
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { createDocsSearch } from "../search.js";
import type {
  DocsSearch,
  DocsSearchDocument,
  DocsSearchIndexStats,
  DocsSearchListEntry,
  DocsSearchResult,
} from "../search.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestFixture {
  readonly docsDir: string;
  readonly indexPath: string;
  readonly rootDir: string;
}

async function createFixture(): Promise<TestFixture> {
  const rootDir = await mkdtemp(join(tmpdir(), "docs-search-test-"));
  const docsDir = join(rootDir, "docs");
  const indexPath = join(rootDir, "index.sqlite");

  await mkdir(docsDir, { recursive: true });

  await writeFile(
    join(docsDir, "getting-started.md"),
    [
      "# Getting Started",
      "",
      "Welcome to the project. This guide will help you set up your development environment.",
      "",
      "## Installation",
      "",
      "Run the following command to install dependencies.",
      "",
    ].join("\n")
  );

  await writeFile(
    join(docsDir, "authentication.md"),
    [
      "# Authentication",
      "",
      "This document covers authentication and authorization flows.",
      "",
      "## OAuth Setup",
      "",
      "Configure your OAuth provider credentials.",
      "",
    ].join("\n")
  );

  await writeFile(
    join(docsDir, "deployment.md"),
    [
      "# Deployment",
      "",
      "Deploy your application to production environments.",
      "",
      "## Docker",
      "",
      "Build and run with Docker for consistent deployments.",
      "",
    ].join("\n")
  );

  return { rootDir, docsDir, indexPath };
}

/** Unwrap a Result from createDocsSearch, failing the test on Err. */
async function createDocsSearchOrFail(
  config: Parameters<typeof createDocsSearch>[0]
): Promise<DocsSearch> {
  const result = await createDocsSearch(config);
  if (result.isErr()) {
    throw new Error(`createDocsSearch failed: ${result.error.message}`);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createDocsSearch", () => {
  const instances: DocsSearch[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const instance of instances) {
      const closeResult = await instance.close();
      if (closeResult.isErr()) {
        console.warn(
          "close() failed during teardown:",
          closeResult.error.message
        );
      }
    }
    instances.length = 0;

    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("exports the public search result types from the package entry point", () => {
    const document: DocsSearchDocument = {
      content: "# Getting Started",
      title: "Getting Started",
    };
    const entry: DocsSearchListEntry = {
      id: "/docs/getting-started.md",
      title: "Getting Started",
    };
    const stats: DocsSearchIndexStats = {
      failed: 0,
      indexed: 1,
      total: 1,
    };
    const result: DocsSearchResult = {
      id: entry.id,
      score: -0.5,
      snippet: "Getting Started",
      title: document.title,
    };

    expect(document.title).toBe("Getting Started");
    expect(entry.id).toBe("/docs/getting-started.md");
    expect(stats.indexed).toBe(1);
    expect(result.title).toBe("Getting Started");
  });

  it("returns Ok with a valid DocsSearch instance", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);

    const result = await createDocsSearch({
      name: "test-project",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const docs = result.value;
      instances.push(docs);
      expect(typeof docs.search).toBe("function");
      expect(typeof docs.index).toBe("function");
      expect(typeof docs.get).toBe("function");
      expect(typeof docs.list).toBe("function");
      expect(typeof docs.close).toBe("function");
    }
  });

  describe("index()", () => {
    it("scans and indexes markdown files from paths", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      const result = await docs.index();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.indexed).toBe(3);
        expect(result.value.total).toBe(3);
        expect(result.value.failed).toBe(0);
      }
    });

    it("skips unchanged files on re-index", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      // First index
      await docs.index();

      // Second index — should skip all unchanged files
      const result = await docs.index();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.indexed).toBe(0);
        expect(result.value.total).toBe(3);
      }
    });

    it("re-indexes files with changed content", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Modify one file
      await writeFile(
        join(fixture.docsDir, "getting-started.md"),
        "# Updated Guide\n\nThis content has been completely rewritten.\n"
      );

      const result = await docs.index();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.indexed).toBe(1);
        expect(result.value.total).toBe(3);
      }
    });

    it("removes stale entries when source files are deleted", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Delete one file
      await rm(join(fixture.docsDir, "deployment.md"));

      await docs.index();

      // Deleted file should no longer appear
      const listed = await docs.list();
      if (listed.isOk()) {
        expect(listed.value.every((d) => !d.title.includes("Deployment"))).toBe(
          true
        );
      }

      const searched = await docs.search("Docker");
      if (searched.isOk()) {
        expect(searched.value.length).toBe(0);
      }
    });

    it("does not wipe the index when no files match the configured globs", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const indexedSession = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });

      const firstIndex = await indexedSession.index();
      expect(firstIndex.isOk()).toBe(true);
      const closeResult = await indexedSession.close();
      expect(closeResult.isOk()).toBe(true);

      const misconfiguredSession = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.txt")],
        indexPath: fixture.indexPath,
      });
      instances.push(misconfiguredSession);

      const reindexResult = await misconfiguredSession.index();
      expect(reindexResult.isOk()).toBe(true);
      if (reindexResult.isOk()) {
        expect(reindexResult.value.indexed).toBe(0);
        expect(reindexResult.value.total).toBe(0);
      }

      const listed = await misconfiguredSession.list();
      expect(listed.isOk()).toBe(true);
      if (listed.isOk()) {
        expect(listed.value.length).toBe(3);
      }

      const searched = await misconfiguredSession.search("Docker");
      expect(searched.isOk()).toBe(true);
      if (searched.isOk()) {
        expect(searched.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe("search()", () => {
    it("returns BM25-scored results", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.search("authentication OAuth");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBeGreaterThan(0);
        const first = result.value[0];
        expect(first).toBeDefined();
        if (first) {
          expect(first.id).toBeDefined();
          expect(first.score).toBeDefined();
          expect(typeof first.score).toBe("number");
          expect(first.title).toBeDefined();
        }
      }
    });

    it("respects the limit option", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.search("your", { limit: 1 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("list()", () => {
    it("returns all indexed documents", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.list();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBe(3);
        // IDs are absolute file paths
        for (const entry of result.value) {
          expect(entry.id).toBeDefined();
          expect(entry.title).toBeDefined();
        }
      }
    });

    it("hydrates from an existing index on a fresh instance", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const session1 = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });

      const firstIndex = await session1.index();
      expect(firstIndex.isOk()).toBe(true);
      const closeResult = await session1.close();
      expect(closeResult.isOk()).toBe(true);

      const session2 = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(session2);

      const listing = await session2.list();

      expect(listing.isOk()).toBe(true);
      if (listing.isOk()) {
        expect(listing.value.length).toBe(3);
      }
    });
  });

  describe("get()", () => {
    it("retrieves a document by ID", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Get the list first to find a valid ID
      const listed = await docs.list();
      expect(listed.isOk()).toBe(true);
      if (listed.isOk() && listed.value.length > 0) {
        const firstId = listed.value[0]?.id;
        if (firstId) {
          const result = await docs.get(firstId);
          expect(result.isOk()).toBe(true);
          if (result.isOk() && result.value) {
            expect(result.value.content).toBeDefined();
            expect(result.value.title).toBeDefined();
          }
        }
      }
    });

    it("hydrates from an existing index before reading a document", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const session1 = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });

      const firstIndex = await session1.index();
      expect(firstIndex.isOk()).toBe(true);
      const closeResult = await session1.close();
      expect(closeResult.isOk()).toBe(true);

      const session2 = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(session2);

      const result = await session2.get(
        join(fixture.docsDir, "getting-started.md")
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk() && result.value) {
        expect(result.value.title).toBe("Getting Started");
        expect(result.value.content).toContain("development environment");
      }
    });

    it("returns undefined for unknown ID", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      const result = await docs.get("nonexistent-doc");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeUndefined();
      }
    });
  });

  describe("close()", () => {
    it("returns Ok after releasing resources", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });

      const result = await docs.close();

      expect(result.isOk()).toBe(true);
    });
  });

  describe("custom indexPath", () => {
    it("uses the provided index path", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);
      const customPath = join(fixture.rootDir, "custom", "search.sqlite");

      const docs = await createDocsSearchOrFail({
        name: "test-project",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: customPath,
      });
      instances.push(docs);

      await docs.index();
      expect(existsSync(customPath)).toBe(true);
    });
  });

  describe("default path derivation", () => {
    it("derives default index path from project name", async () => {
      const uniqueName = `test-project-${Date.now()}`;
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: uniqueName,
        paths: [join(fixture.docsDir, "**/*.md")],
      });
      instances.push(docs);

      await docs.index();

      const expectedDir = join(homedir(), `.${uniqueName}`, "docs");
      expect(existsSync(expectedDir)).toBe(true);

      // Cleanup the homedir-based path
      tempDirs.push(join(homedir(), `.${uniqueName}`));
    });
  });
});
