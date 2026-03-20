import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDocsSearch } from "../search.js";

describe("createDocsSearch", () => {
  const cleanupDirs: string[] = [];

  afterEach(async () => {
    for (const dir of cleanupDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    cleanupDirs.length = 0;
  });

  async function makeTmpDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "docs-search-test-"));
    cleanupDirs.push(dir);
    return dir;
  }

  it("creates a search instance with all expected methods", async () => {
    const tmpDir = await makeTmpDir();
    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: join(tmpDir, "assembled"),
    });

    expect(docs.search).toBeFunction();
    expect(docs.index).toBeFunction();
    expect(docs.get).toBeFunction();
    expect(docs.list).toBeFunction();
    expect(docs.close).toBeFunction();

    await docs.close();
  });

  it("indexes markdown files and reports counts", async () => {
    const tmpDir = await makeTmpDir();
    const assemblyDir = join(tmpDir, "assembled");
    await mkdir(assemblyDir, { recursive: true });

    await writeFile(
      join(assemblyDir, "handler-contract.md"),
      "# Handler Contract\n\nAll handlers return Result<T, E>. The handler pattern uses createContext for request metadata."
    );
    await writeFile(
      join(assemblyDir, "error-taxonomy.md"),
      "# Error Taxonomy\n\nOutfitter uses 10 error categories: validation, not_found, conflict, permission, timeout, rate_limit, network, internal, auth, cancelled."
    );

    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: assemblyDir,
    });

    const indexResult = await docs.index();
    expect(indexResult.isOk()).toBe(true);
    if (indexResult.isOk()) {
      expect(indexResult.value.indexed).toBe(2);
    }

    await docs.close();
  });

  it("returns results from lexical search after indexing", async () => {
    const tmpDir = await makeTmpDir();
    const assemblyDir = join(tmpDir, "assembled");
    await mkdir(assemblyDir, { recursive: true });

    await writeFile(
      join(assemblyDir, "handler-contract.md"),
      "# Handler Contract\n\nAll handlers return Result<T, E>. The handler pattern uses createContext for request metadata."
    );
    await writeFile(
      join(assemblyDir, "error-taxonomy.md"),
      "# Error Taxonomy\n\nOutfitter uses 10 error categories: validation, not_found, conflict, permission, timeout, rate_limit, network, internal, auth, cancelled."
    );

    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: assemblyDir,
    });

    await docs.index();

    const searchResult = await docs.search("handler Result pattern");
    expect(searchResult.isOk()).toBe(true);
    if (searchResult.isOk()) {
      expect(searchResult.value.length).toBeGreaterThan(0);
      const first = searchResult.value[0];
      expect(first).toBeDefined();
      expect(first?.score).toBeGreaterThan(0);
      expect(first?.title).toBeDefined();
      expect(first?.path).toBeDefined();
      expect(first?.snippet).toBeDefined();
    }

    await docs.close();
  });

  it("lists indexed documents", async () => {
    const tmpDir = await makeTmpDir();
    const assemblyDir = join(tmpDir, "assembled");
    await mkdir(assemblyDir, { recursive: true });

    await writeFile(
      join(assemblyDir, "doc-one.md"),
      "# Document One\n\nContent here."
    );
    await writeFile(
      join(assemblyDir, "doc-two.md"),
      "# Document Two\n\nMore content."
    );

    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: assemblyDir,
    });

    await docs.index();

    const listResult = await docs.list();
    expect(listResult.isOk()).toBe(true);
    if (listResult.isOk()) {
      expect(listResult.value.length).toBe(2);
      const paths = listResult.value.map((d) => d.path);
      // qmd paths include the collection name prefix
      expect(paths).toContain("docs/doc-one.md");
      expect(paths).toContain("docs/doc-two.md");
    }

    await docs.close();
  });

  it("gets a specific document by path", async () => {
    const tmpDir = await makeTmpDir();
    const assemblyDir = join(tmpDir, "assembled");
    await mkdir(assemblyDir, { recursive: true });

    await writeFile(
      join(assemblyDir, "target.md"),
      "# Target Doc\n\nThis is the target document content."
    );

    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: assemblyDir,
    });

    await docs.index();

    const getResult = await docs.get("target.md");
    expect(getResult.isOk()).toBe(true);
    if (getResult.isOk()) {
      expect(getResult.value.title).toBe("Target Doc");
      expect(getResult.value.content).toContain("target document content");
    }

    await docs.close();
  });

  it("returns error for non-existent document", async () => {
    const tmpDir = await makeTmpDir();
    const docs = await createDocsSearch({
      name: "test",
      paths: [],
      indexPath: join(tmpDir, "index.sqlite"),
      assemblyPath: join(tmpDir, "assembled"),
    });

    const getResult = await docs.get("nonexistent.md");
    expect(getResult.isErr()).toBe(true);

    await docs.close();
  });
});
