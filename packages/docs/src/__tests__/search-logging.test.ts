/**
 * Tests for structured logging in docs search hydration and indexing.
 *
 * Validates that the optional logger receives warnings when rows are
 * skipped during hydration or files fail to read during indexing.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDocsSearch } from "../search.js";
import type { DocsSearch, DocsSearchLogger } from "../search.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LogEntry {
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

function createSpyLogger(): DocsSearchLogger & {
  readonly warnings: LogEntry[];
} {
  const warnings: LogEntry[] = [];
  return {
    warnings,
    warn(message: string, metadata?: Record<string, unknown>): void {
      warnings.push({ message, metadata });
    },
  };
}

interface TestFixture {
  readonly docsDir: string;
  readonly indexPath: string;
  readonly rootDir: string;
}

async function createFixture(): Promise<TestFixture> {
  const rootDir = await mkdtemp(join(tmpdir(), "docs-search-log-test-"));
  const docsDir = join(rootDir, "docs");
  const indexPath = join(rootDir, "index.sqlite");

  await mkdir(docsDir, { recursive: true });

  await writeFile(
    join(docsDir, "example.md"),
    ["# Example", "", "Some example content for testing."].join("\n")
  );

  return { rootDir, docsDir, indexPath };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("docs search logging", () => {
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

  it("does not warn when hydration has no issues", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);
    const logger = createSpyLogger();

    const result = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
      logger,
    });

    if (result.isErr()) throw result.error;
    const docs = result.value;
    instances.push(docs);

    await docs.index();

    // Re-create to trigger hydration from existing index
    await docs.close();
    instances.pop();

    const result2 = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
      logger,
    });

    if (result2.isErr()) throw result2.error;
    const docs2 = result2.value;
    instances.push(docs2);

    await docs2.list();

    expect(logger.warnings).toHaveLength(0);
  });

  it("warns when hydrating rows with missing metadata", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);

    // First: create a valid index
    const result = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
    });
    if (result.isErr()) throw result.error;
    const docs = result.value;
    instances.push(docs);
    await docs.index();
    await docs.close();
    instances.pop();

    // Corrupt a row by nulling its metadata
    const db = new Database(fixture.indexPath);
    db.run("UPDATE documents SET metadata = NULL WHERE rowid = 1");
    db.close();

    // Now create a new instance with logger and trigger hydration
    const logger = createSpyLogger();
    const result2 = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
      logger,
    });
    if (result2.isErr()) throw result2.error;
    const docs2 = result2.value;
    instances.push(docs2);

    await docs2.list();

    const missingMetaWarnings = logger.warnings.filter((w) =>
      w.message.includes("missing metadata")
    );
    expect(missingMetaWarnings.length).toBeGreaterThan(0);
  });

  it("warns when hydrating rows with invalid JSON metadata", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);

    // Create a valid index
    const result = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
    });
    if (result.isErr()) throw result.error;
    const docs = result.value;
    instances.push(docs);
    await docs.index();
    await docs.close();
    instances.pop();

    // Corrupt metadata to invalid JSON
    const db = new Database(fixture.indexPath);
    db.run("UPDATE documents SET metadata = '{broken' WHERE rowid = 1");
    db.close();

    const logger = createSpyLogger();
    const result2 = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
      logger,
    });
    if (result2.isErr()) throw result2.error;
    const docs2 = result2.value;
    instances.push(docs2);

    await docs2.list();

    const jsonWarnings = logger.warnings.filter((w) =>
      w.message.includes("invalid metadata JSON")
    );
    expect(jsonWarnings.length).toBeGreaterThan(0);
  });

  it("warns on file read failures during indexing", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);
    const logger = createSpyLogger();

    // Call prepareIndexDocuments directly with a non-existent path
    // to exercise the file-read failure warning branch.
    const { prepareIndexDocuments } =
      await import("../internal/search-indexing.js");

    const nonExistentPath = join(fixture.docsDir, "does-not-exist.md");
    const registry = new Map<
      string,
      import("../internal/search-types.js").DocRegistryEntry
    >();

    await prepareIndexDocuments([nonExistentPath], registry, logger);

    const readFailureWarnings = logger.warnings.filter((w) =>
      w.message.includes("Failed to read")
    );
    expect(readFailureWarnings.length).toBeGreaterThan(0);
    expect(readFailureWarnings[0]?.metadata?.path).toBe(nonExistentPath);
  });

  it("accepts config without logger (backward compatible)", async () => {
    const fixture = await createFixture();
    tempDirs.push(fixture.rootDir);

    const result = await createDocsSearch({
      name: "test",
      paths: [join(fixture.docsDir, "**/*.md")],
      indexPath: fixture.indexPath,
    });

    if (result.isErr()) throw result.error;
    const docs = result.value;
    instances.push(docs);

    const indexResult = await docs.index();
    expect(indexResult.isOk()).toBe(true);
  });
});
