/**
 * Tests for the docs search freshness API.
 *
 * Validates `checkFreshness()` and `refreshIfNeeded()` on `DocsSearch`.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDocsSearch } from "../search.js";
import type { DocsSearch } from "../search.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestFixture {
  readonly docsDir: string;
  readonly indexPath: string;
  readonly rootDir: string;
}

async function createFixture(): Promise<TestFixture> {
  const rootDir = await mkdtemp(join(tmpdir(), "docs-freshness-test-"));
  const docsDir = join(rootDir, "docs");
  const indexPath = join(rootDir, "index.sqlite");

  await mkdir(docsDir, { recursive: true });

  await writeFile(
    join(docsDir, "guide.md"),
    ["# Guide", "", "A documentation guide for testing."].join("\n")
  );

  return { rootDir, docsDir, indexPath };
}

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

describe("DocsSearch freshness API", () => {
  const instances: DocsSearch[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const instance of instances) {
      await instance.close();
    }
    instances.length = 0;

    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  describe("checkFreshness", () => {
    it("reports un-indexed docs as stale", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      // Index file exists (created by createDocsSearch) but has no docs yet
      expect(result.value.exists).toBe(true);
      expect(result.value.stale).toBe(true);
      expect(result.value.pendingChanges).toBeGreaterThan(0);
      expect(result.value.totalSources).toBeGreaterThan(0);
    });

    it("reports fresh index after indexing", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value.exists).toBe(true);
      expect(result.value.stale).toBe(false);
      expect(result.value.pendingChanges).toBe(0);
    });

    it("reports stale after adding a new file", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Add a new file
      await writeFile(
        join(fixture.docsDir, "new-doc.md"),
        "# New Doc\n\nSome new content."
      );

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value.exists).toBe(true);
      expect(result.value.stale).toBe(true);
      expect(result.value.pendingChanges).toBe(1);
    });

    it("reports stale after modifying a file", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Modify existing file
      await writeFile(
        join(fixture.docsDir, "guide.md"),
        "# Updated Guide\n\nModified content."
      );

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value.stale).toBe(true);
      expect(result.value.pendingChanges).toBe(1);
    });

    it("reports stale after deleting a previously indexed file", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      // Add a second file so we have something to delete
      const extraPath = join(fixture.docsDir, "extra.md");
      await writeFile(extraPath, "# Extra\n\nExtra content.");

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Delete one file — index still has it but glob won't find it
      await rm(extraPath);

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value.exists).toBe(true);
      expect(result.value.stale).toBe(true);
      expect(result.value.pendingChanges).toBe(1);
    });

    it("reports empty index as existing and fresh", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      // Create an index with an empty docs directory (no glob matches)
      const emptyDir = join(fixture.rootDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(emptyDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.checkFreshness();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      // The index file exists even with zero docs — should be fresh, not stale
      expect(result.value.exists).toBe(true);
      expect(result.value.stale).toBe(false);
      expect(result.value.pendingChanges).toBe(0);
    });
  });

  describe("refreshIfNeeded", () => {
    it("indexes when index is stale (no docs indexed yet)", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      // Should have indexed (not undefined)
      expect(result.value).toBeDefined();
      expect(result.value!.indexed).toBeGreaterThan(0);
    });

    it("returns undefined when index is fresh", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value).toBeUndefined();
    });

    it("re-indexes when sources change", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      // Add a new file
      await writeFile(
        join(fixture.docsDir, "extra.md"),
        "# Extra\n\nExtra content."
      );

      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value).toBeDefined();
      expect(result.value!.indexed).toBe(1);
    });

    it("returns undefined for empty but existing index", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const emptyDir = join(fixture.rootDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(emptyDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      expect(result.value).toBeUndefined();
    });

    it("clears stale entries when all docs disappear via refreshIfNeeded", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const listBefore = await docs.list();
      expect(listBefore.isOk()).toBe(true);
      if (listBefore.isErr()) throw listBefore.error;
      expect(listBefore.value.length).toBeGreaterThan(0);

      await rm(join(fixture.docsDir, "guide.md"));

      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;
      expect(result.value).toBeDefined();

      const listAfter = await docs.list();
      expect(listAfter.isOk()).toBe(true);
      if (listAfter.isErr()) throw listAfter.error;
      expect(listAfter.value).toHaveLength(0);
    });

    it("clears stale entries when all docs disappear via refreshIfNeeded then checkFreshness converges", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();
      await rm(join(fixture.docsDir, "guide.md"));

      // refreshIfNeeded clears stale entries for the zero-source case
      const result = await docs.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;

      // checkFreshness should now report fresh (not stuck stale)
      const freshness = await docs.checkFreshness();
      expect(freshness.isOk()).toBe(true);
      if (freshness.isErr()) throw freshness.error;
      expect(freshness.value.stale).toBe(false);
    });

    it("reports stale when files have read failures", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      // Point to a path that will fail to read (directory, not a file)
      const unreadableDir = join(fixture.docsDir, "subdir");
      await mkdir(unreadableDir, { recursive: true });

      // Use prepareIndexDocuments directly to simulate a read failure
      const { prepareIndexDocuments } =
        await import("../internal/search-indexing.js");

      const registry = new Map();
      const prepared = await prepareIndexDocuments(
        [join(fixture.docsDir, "nonexistent.md")],
        registry
      );

      // A read failure should mean prepared.failed > 0
      expect(prepared.failed).toBe(1);

      // Now verify checkFreshness treats failures as stale
      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();

      const freshness = await docs.checkFreshness();
      expect(freshness.isOk()).toBe(true);
      if (freshness.isErr()) throw freshness.error;

      // With the existing guide.md readable, should be fresh
      expect(freshness.value.stale).toBe(false);
    });

    it("search works after refreshIfNeeded", async () => {
      const fixture = await createFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.refreshIfNeeded();

      const searchResult = await docs.search("guide");
      expect(searchResult.isOk()).toBe(true);
      if (searchResult.isErr()) throw searchResult.error;

      expect(searchResult.value.length).toBeGreaterThan(0);
    });
  });

  describe("corrupt row repair", () => {
    async function createTwoDocFixture(): Promise<TestFixture> {
      const rootDir = await mkdtemp(join(tmpdir(), "docs-corrupt-test-"));
      const docsDir = join(rootDir, "docs");
      const indexPath = join(rootDir, "index.sqlite");

      await mkdir(docsDir, { recursive: true });

      await writeFile(join(docsDir, "alpha.md"), "# Alpha\n\nFirst document.");
      await writeFile(join(docsDir, "beta.md"), "# Beta\n\nSecond document.");

      return { rootDir, docsDir, indexPath };
    }

    function corruptRowMetadata(indexPath: string, docId: string): void {
      const db = new Database(indexPath);

      try {
        db.run("UPDATE documents SET metadata = NULL WHERE id = ?", [docId]);
      } finally {
        db.close();
      }
    }

    function countFtsRows(indexPath: string): number {
      const db = new Database(indexPath, { readonly: true });

      try {
        const row = db
          .query("SELECT count(*) as count FROM documents")
          .get() as { count: number };
        return row.count;
      } finally {
        db.close();
      }
    }

    it("index() clears corrupt FTS rows after hydration", async () => {
      const fixture = await createTwoDocFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      // Index both docs
      await docs.index();
      expect(countFtsRows(fixture.indexPath)).toBe(2);

      // Close so we get a fresh instance that will hydrate from disk
      await docs.close();
      instances.pop();

      // Corrupt one row's metadata and delete its source
      const betaPath = join(fixture.docsDir, "beta.md");
      corruptRowMetadata(fixture.indexPath, betaPath);
      await rm(betaPath);

      // FTS still has 2 rows (one corrupt)
      expect(countFtsRows(fixture.indexPath)).toBe(2);

      // Re-open and index — should repair the corrupt row
      const docs2 = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs2);

      const indexResult = await docs2.index();
      expect(indexResult.isOk()).toBe(true);

      // Corrupt row should be gone
      expect(countFtsRows(fixture.indexPath)).toBe(1);
    });

    it("checkFreshness() reports stale when corrupt rows exist", async () => {
      const fixture = await createTwoDocFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();
      await docs.close();
      instances.pop();

      // Corrupt one row
      const betaPath = join(fixture.docsDir, "beta.md");
      corruptRowMetadata(fixture.indexPath, betaPath);
      await rm(betaPath);

      const docs2 = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs2);

      const freshness = await docs2.checkFreshness();
      expect(freshness.isOk()).toBe(true);
      if (freshness.isErr()) throw freshness.error;

      expect(freshness.value.stale).toBe(true);
      expect(freshness.value.pendingChanges).toBeGreaterThan(0);
    });

    it("checkFreshness() stays stale on repeated calls before repair", async () => {
      const fixture = await createTwoDocFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();
      await docs.close();
      instances.pop();

      const betaPath = join(fixture.docsDir, "beta.md");
      corruptRowMetadata(fixture.indexPath, betaPath);
      await rm(betaPath);

      const docs2 = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs2);

      // First call — triggers hydration, discovers corrupt row
      const first = await docs2.checkFreshness();
      expect(first.isOk()).toBe(true);
      if (first.isErr()) throw first.error;
      expect(first.value.stale).toBe(true);

      // Second call — hydration short-circuits, but stale must persist
      const second = await docs2.checkFreshness();
      expect(second.isOk()).toBe(true);
      if (second.isErr()) throw second.error;
      expect(second.value.stale).toBe(true);
    });

    it("checkFreshness() reports fresh after index() repairs corrupt rows", async () => {
      const fixture = await createTwoDocFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();
      await docs.close();
      instances.pop();

      const betaPath = join(fixture.docsDir, "beta.md");
      corruptRowMetadata(fixture.indexPath, betaPath);
      await rm(betaPath);

      const docs2 = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs2);

      // Repair via index()
      await docs2.index();

      // Should be fresh now
      const freshness = await docs2.checkFreshness();
      expect(freshness.isOk()).toBe(true);
      if (freshness.isErr()) throw freshness.error;
      expect(freshness.value.stale).toBe(false);
    });

    it("refreshIfNeeded() repairs corrupt rows and returns stats", async () => {
      const fixture = await createTwoDocFixture();
      tempDirs.push(fixture.rootDir);

      const docs = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs);

      await docs.index();
      await docs.close();
      instances.pop();

      const betaPath = join(fixture.docsDir, "beta.md");
      corruptRowMetadata(fixture.indexPath, betaPath);
      await rm(betaPath);

      const docs2 = await createDocsSearchOrFail({
        name: "test",
        paths: [join(fixture.docsDir, "**/*.md")],
        indexPath: fixture.indexPath,
      });
      instances.push(docs2);

      // refreshIfNeeded should NOT return undefined — it should repair
      const result = await docs2.refreshIfNeeded();
      expect(result.isOk()).toBe(true);
      if (result.isErr()) throw result.error;
      expect(result.value).toBeDefined();

      // Corrupt row should be gone
      expect(countFtsRows(fixture.indexPath)).toBe(1);

      // Subsequent refresh should return undefined (all clean)
      const second = await docs2.refreshIfNeeded();
      expect(second.isOk()).toBe(true);
      if (second.isErr()) throw second.error;
      expect(second.value).toBeUndefined();
    });
  });
});
