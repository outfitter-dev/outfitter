/**
 * Tests for `docs.index` and `mcp.docs.index` actions.
 *
 * Covers action registration, mapInput, handler behavior with temp directories,
 * and incremental indexing (skip unchanged files).
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Result } from "@outfitter/contracts";
import { createIndex } from "@outfitter/index";

import { outfitterActions } from "../actions.js";
import type { DocsIndexOutput } from "../commands/docs-index.js";
import { runDocsIndex } from "../commands/docs-index.js";
import type { DocsModule } from "../commands/docs-module-loader.js";
import * as docsModuleLoader from "../commands/docs-module-loader.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(
    tmpdir(),
    `outfitter-docs-index-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTmpDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createDocsModuleMock(
  entries: Array<{
    readonly id: string;
    readonly kind: string;
    readonly outputPath: string;
    readonly sourcePath: string;
    readonly title: string;
  }>
): DocsModule {
  return {
    createDocsCommand: (() => {
      throw new Error("Not implemented in test mock");
    }) as DocsModule["createDocsCommand"],
    executeCheckCommand: async () => 0,
    executeExportCommand: async () => 0,
    executeSyncCommand: async () => 0,
    generateDocsMap: async () => Result.ok({ entries }),
    generatePackageListSection: async () => "",
    replaceSentinelSection: (input) => input,
  };
}

// ---------------------------------------------------------------------------
// CLI Action Registration
// ---------------------------------------------------------------------------

describe("docs.index action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.index");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.index");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
  });

  test("has CLI group 'docs' and command 'index'", () => {
    const action = outfitterActions.get("docs.index");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("index");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// MCP Action Registration
// ---------------------------------------------------------------------------

describe("mcp.docs.index action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("mcp.docs.index");
    expect(action).toBeDefined();
    expect(action?.id).toBe("mcp.docs.index");
    expect(action?.surfaces).toContain("mcp");
  });

  test("does not include cli surface", () => {
    const action = outfitterActions.get("mcp.docs.index");
    expect(action?.surfaces).not.toContain("cli");
  });

  test("has mcp tool name 'index_docs'", () => {
    const action = outfitterActions.get("mcp.docs.index");
    expect(action?.mcp?.tool).toBe("index_docs");
  });

  test("has idempotent annotation", () => {
    const action = outfitterActions.get("mcp.docs.index");
    expect(action?.mcp?.idempotent).toBe(true);
  });

  test("requires an explicit cwd in the MCP input schema", () => {
    const action = outfitterActions.get("mcp.docs.index");
    const parsed = action?.input.safeParse({});

    expect(parsed?.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler — runDocsIndex
// ---------------------------------------------------------------------------

describe("runDocsIndex", () => {
  let tmpDir: string;
  let indexDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    indexDir = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(tmpDir);
    cleanupTmpDir(indexDir);
  });

  test("returns error when docs module fails to generate map", async () => {
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue({
      ...createDocsModuleMock([]),
      generateDocsMap: async () => Result.err(new Error("docs map failed")),
    });

    const result = await runDocsIndex({
      cwd: tmpDir,
      outputMode: "json",
      indexPath: join(indexDir, "index.sqlite"),
    });

    expect(result.isErr()).toBe(true);
  });

  test("indexes markdown files and returns counts", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(
      join(docsDir, "guide.md"),
      "# Guide\n\nThis is a guide about handlers."
    );
    await Bun.write(
      join(docsDir, "reference.md"),
      "# Reference\n\nResult types for error handling."
    );
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(
      createDocsModuleMock([
        {
          id: "docs.guide",
          kind: "guide",
          outputPath: "docs/guide.md",
          sourcePath: "docs/guide.md",
          title: "Guide",
        },
        {
          id: "docs.reference",
          kind: "reference",
          outputPath: "docs/reference.md",
          sourcePath: "docs/reference.md",
          title: "Reference",
        },
      ])
    );

    const indexPath = join(indexDir, "index.sqlite");
    const result = await runDocsIndex({
      cwd: tmpDir,
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const output: DocsIndexOutput = result.value;
    expect(output.total).toBe(2);
    expect(output.indexed).toBe(2);
    expect(output.skipped).toBe(0);
    expect(output.failed).toBe(0);
    expect(output.indexPath).toBe(indexPath);
    expect(existsSync(indexPath)).toBe(true);
  });

  test("incremental indexing skips unchanged files", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(join(docsDir, "guide.md"), "# Guide\n\nSome content.");
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(
      createDocsModuleMock([
        {
          id: "docs.guide",
          kind: "guide",
          outputPath: "docs/guide.md",
          sourcePath: "docs/guide.md",
          title: "Guide",
        },
      ])
    );

    const indexPath = join(indexDir, "index.sqlite");
    const input = { cwd: tmpDir, outputMode: "json" as const, indexPath };

    const first = await runDocsIndex(input);
    expect(first.isOk()).toBe(true);
    if (first.isErr()) {
      return;
    }

    const second = await runDocsIndex(input);
    expect(second.isOk()).toBe(true);
    if (second.isErr()) {
      return;
    }

    expect(second.value.skipped).toBe(second.value.total);
    expect(second.value.indexed).toBe(0);
  });

  test("re-indexes files when content changes", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    const guidePath = join(docsDir, "guide.md");
    await Bun.write(guidePath, "# Guide\n\nOriginal content.");
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(
      createDocsModuleMock([
        {
          id: "docs.guide",
          kind: "guide",
          outputPath: "docs/guide.md",
          sourcePath: "docs/guide.md",
          title: "Guide",
        },
      ])
    );

    const indexPath = join(indexDir, "index.sqlite");
    const input = { cwd: tmpDir, outputMode: "json" as const, indexPath };

    const first = await runDocsIndex(input);
    expect(first.isOk()).toBe(true);
    if (first.isErr()) {
      return;
    }

    await Bun.write(guidePath, "# Guide\n\nUpdated content with new info.");

    const second = await runDocsIndex(input);
    expect(second.isOk()).toBe(true);
    if (second.isErr()) {
      return;
    }

    expect(second.value.indexed).toBeGreaterThan(0);
  });

  test("removes stale entries when docs are deleted from workspace", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    const guidePath = join(docsDir, "guide.md");
    const faqPath = join(docsDir, "faq.md");
    await Bun.write(guidePath, "# Guide\n\nSetup instructions.");
    await Bun.write(faqPath, "# FAQ\n\nFrequently asked questions.");

    const twoDocsMock = createDocsModuleMock([
      {
        id: "docs.guide",
        kind: "guide",
        outputPath: "docs/guide.md",
        sourcePath: "docs/guide.md",
        title: "Guide",
      },
      {
        id: "docs.faq",
        kind: "guide",
        outputPath: "docs/faq.md",
        sourcePath: "docs/faq.md",
        title: "FAQ",
      },
    ]);

    const oneDocMock = createDocsModuleMock([
      {
        id: "docs.guide",
        kind: "guide",
        outputPath: "docs/guide.md",
        sourcePath: "docs/guide.md",
        title: "Guide",
      },
    ]);

    const indexPath = join(indexDir, "index.sqlite");
    const input = { cwd: tmpDir, outputMode: "json" as const, indexPath };

    // First run: index both docs
    using _firstSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(twoDocsMock);
    const first = await runDocsIndex(input);
    expect(first.isOk()).toBe(true);
    if (first.isErr()) return;
    expect(first.value.indexed).toBe(2);

    // Second run: FAQ removed from workspace
    _firstSpy[Symbol.dispose]();
    rmSync(faqPath);
    using _secondSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(oneDocMock);
    const second = await runDocsIndex(input);
    expect(second.isOk()).toBe(true);
    if (second.isErr()) return;
    expect(second.value.removed).toBeGreaterThan(0);
  });

  test("creates index at specified indexPath", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(join(docsDir, "guide.md"), "# Guide\n\nSome content.");
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(
      createDocsModuleMock([
        {
          id: "docs.guide",
          kind: "guide",
          outputPath: "docs/guide.md",
          sourcePath: "docs/guide.md",
          title: "Guide",
        },
      ])
    );

    const indexPath = join(indexDir, "custom", "docs.sqlite");
    const result = await runDocsIndex({
      cwd: tmpDir,
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.indexPath).toBe(indexPath);
      expect(existsSync(indexPath)).toBe(true);
    }
  });

  test("indexed documents are searchable via the index", async () => {
    const docsDir = join(tmpDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(
      join(docsDir, "handlers.md"),
      "# Handlers\n\nHandlers are pure functions returning Result types."
    );
    using _loadDocsModuleSpy = spyOn(
      docsModuleLoader,
      "loadDocsModule"
    ).mockResolvedValue(
      createDocsModuleMock([
        {
          id: "docs.handlers",
          kind: "guide",
          outputPath: "docs/handlers.md",
          sourcePath: "docs/handlers.md",
          title: "Handlers",
        },
      ])
    );

    const indexPath = join(indexDir, "index.sqlite");
    const result = await runDocsIndex({
      cwd: tmpDir,
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const index = createIndex({ path: indexPath, tokenizer: "porter" });
    const searchResult = await index.search({ query: "handlers" });
    index.close();

    expect(searchResult.isOk()).toBe(true);
    if (searchResult.isOk()) {
      expect(searchResult.value.length).toBeGreaterThan(0);
    }
  });
});
