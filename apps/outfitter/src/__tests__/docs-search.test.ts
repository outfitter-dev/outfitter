/**
 * Tests for `docs.search` and `mcp.docs.search` actions.
 *
 * Covers action registration, mapInput, FTS5 search handler behavior,
 * lazy indexing, BM25 scoring, and limit flag.
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
import { resolveIndexPath } from "../commands/docs-index.js";
import type { DocsModule } from "../commands/docs-module-loader.js";
import * as docsModuleLoader from "../commands/docs-module-loader.js";
import type { DocsSearchOutput } from "../commands/docs-search.js";
import { runDocsSearch } from "../commands/docs-search.js";
import { VERSION } from "../version.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  const dir = join(
    tmpdir(),
    `outfitter-docs-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe("docs.search action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.search");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.search");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
  });

  test("has CLI group 'docs' and command 'search <query>'", () => {
    const action = outfitterActions.get("docs.search");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("search <query>");
  });

  test("mapInput resolves positional query argument", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: {},
    }) as { query: string };

    expect(mapped.query).toBe("handler");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves --limit flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { limit: "5" },
    }) as { limit: number | undefined };

    expect(mapped.limit).toBe(5);
  });

  test("invalid --limit values fail schema validation instead of silently defaulting", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { limit: "abc", output: "json" },
    });
    const parsed = action?.input.safeParse(mapped);

    expect(parsed?.success).toBe(false);
  });

  test("mapInput resolves --index-path flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { indexPath: "/custom/docs.sqlite" },
    }) as { indexPath: string | undefined };

    expect(mapped.indexPath).toBe("/custom/docs.sqlite");
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("mapInput resolves --jq expression", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { output: "json", jq: ".matches[0]" },
    }) as { jq: string | undefined };

    expect(mapped.jq).toBe(".matches[0]");
  });

  test("does not have --kind or --package flags", () => {
    const action = outfitterActions.get("docs.search");
    const options = action?.cli?.options ?? [];
    const flagStrings = options.map((o: { flags: string }) => o.flags);
    expect(flagStrings.some((f: string) => f.includes("--kind"))).toBe(false);
    expect(flagStrings.some((f: string) => f.includes("--package"))).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// MCP Action Registration
// ---------------------------------------------------------------------------

describe("mcp.docs.search action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("mcp.docs.search");
    expect(action).toBeDefined();
    expect(action?.id).toBe("mcp.docs.search");
    expect(action?.surfaces).toContain("mcp");
  });

  test("does not include cli surface", () => {
    const action = outfitterActions.get("mcp.docs.search");
    expect(action?.surfaces).not.toContain("cli");
  });

  test("has mcp tool name 'search_docs'", () => {
    const action = outfitterActions.get("mcp.docs.search");
    expect(action?.mcp?.tool).toBe("search_docs");
  });

  test("has readOnly annotation", () => {
    const action = outfitterActions.get("mcp.docs.search");
    expect(action?.mcp?.readOnly).toBe(true);
  });

  test("input schema includes limit and indexPath but not kind or package", () => {
    const action = outfitterActions.get("mcp.docs.search");
    const schema = action?.input;
    if (!schema) return;

    const validResult = schema.safeParse({
      cwd: ".",
      query: "test",
      limit: 5,
      indexPath: "/tmp/docs.sqlite",
    });
    expect(validResult.success).toBe(true);

    const withOldFields = schema.safeParse({
      cwd: ".",
      query: "test",
      kind: "guide",
      package: "cli",
    });
    if (withOldFields.success) {
      const data = withOldFields.data as Record<string, unknown>;
      expect(data["kind"]).toBeUndefined();
      expect(data["package"]).toBeUndefined();
    }
  });

  test("input schema rejects limit values outside the supported range", () => {
    const action = outfitterActions.get("mcp.docs.search");
    const schema = action?.input;
    if (!schema) return;

    expect(
      schema.safeParse({ cwd: ".", query: "test", limit: 0 }).success
    ).toBe(false);
    expect(
      schema.safeParse({ cwd: ".", query: "test", limit: 101 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler — runDocsSearch with FTS5
// ---------------------------------------------------------------------------

describe("runDocsSearch", () => {
  let indexDir: string;

  beforeEach(() => {
    indexDir = createTmpDir();
  });

  afterEach(() => {
    cleanupTmpDir(indexDir);
  });

  test("searches an existing FTS5 index and returns BM25-scored results", async () => {
    const indexPath = join(indexDir, "index.sqlite");

    // Seed the index with test documents
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
      readonly package?: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    await index.add({
      id: "guide-handlers",
      content:
        "Handlers are pure functions returning Result types. Every handler receives validated input and a context object.",
      metadata: { title: "Handler Guide", kind: "guide", package: "contracts" },
    });

    await index.add({
      id: "ref-errors",
      content:
        "Error taxonomy defines 10 categories. Each error maps to exit codes and HTTP status codes.",
      metadata: { title: "Error Reference", kind: "reference" },
    });

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "handlers",
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const output: DocsSearchOutput = result.value;
      expect(output.query).toBe("handlers");
      expect(output.total).toBeGreaterThan(0);
      expect(output.matches.length).toBeGreaterThan(0);

      const firstMatch = output.matches[0];
      expect(firstMatch).toBeDefined();
      expect(firstMatch?.id).toBe("guide-handlers");
      expect(firstMatch?.title).toBe("Handler Guide");
      expect(typeof firstMatch?.score).toBe("number");
      expect(firstMatch?.snippet).toBeDefined();
      expect(firstMatch?.snippet.length).toBeGreaterThan(0);
    }
  });

  test("returns metadata fields (package, kind) from indexed documents", async () => {
    const indexPath = join(indexDir, "index.sqlite");
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
      readonly package?: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    await index.add({
      id: "guide-cli",
      content: "CLI commands are built with CommandBuilder pattern.",
      metadata: { title: "CLI Guide", kind: "guide", package: "cli" },
    });

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "CLI commands",
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const match = result.value.matches[0];
      expect(match?.package).toBe("cli");
      expect(match?.kind).toBe("guide");
    }
  });

  test("results are ordered by BM25 relevance", async () => {
    const indexPath = join(indexDir, "index.sqlite");
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    await index.add({
      id: "doc-partial",
      content: "This document mentions handler once in passing.",
      metadata: { title: "Partial Match", kind: "guide" },
    });

    await index.add({
      id: "doc-strong",
      content:
        "Handler patterns: handler functions, handler context, handler input. Handlers return Result types. The handler contract is central.",
      metadata: { title: "Strong Match", kind: "reference" },
    });

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "handler",
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.matches.length).toBe(2);
      // BM25: lower (more negative) score = better match, so first result
      // should have a lower or equal score than second
      const scores = result.value.matches.map((m) => m.score);
      expect(scores[0]).toBeLessThanOrEqual(scores[1]!);
    }
  });

  test("respects limit parameter", async () => {
    const indexPath = join(indexDir, "index.sqlite");
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    for (let i = 0; i < 5; i++) {
      await index.add({
        id: `doc-${i}`,
        content: `Document ${i} about testing patterns and best practices.`,
        metadata: { title: `Doc ${i}`, kind: "guide" },
      });
    }

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "testing patterns",
      outputMode: "json",
      limit: 2,
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.matches.length).toBeLessThanOrEqual(2);
      expect(result.value.total).toBe(5);
    }
  });

  test("returns empty matches for no-match query", async () => {
    const indexPath = join(indexDir, "index.sqlite");
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    await index.add({
      id: "doc-1",
      content: "This document is about TypeScript configuration.",
      metadata: { title: "TS Config", kind: "reference" },
    });

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "xyzzyplugh",
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.matches).toHaveLength(0);
      expect(result.value.total).toBe(0);
      expect(result.value.query).toBe("xyzzyplugh");
    }
  });

  test("defaults limit to 10 when not specified", async () => {
    const indexPath = join(indexDir, "index.sqlite");
    const index = createIndex<{
      readonly [key: string]: unknown;
      readonly title: string;
      readonly kind: string;
    }>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    // Add 15 documents all matching the query
    for (let i = 0; i < 15; i++) {
      await index.add({
        id: `doc-${i}`,
        content: `Document ${i} covers handler implementation details.`,
        metadata: { title: `Doc ${i}`, kind: "guide" },
      });
    }

    index.close();

    const result = await runDocsSearch({
      cwd: process.cwd(),
      query: "handler implementation",
      outputMode: "json",
      indexPath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.total).toBe(15);
      expect(result.value.matches.length).toBeLessThanOrEqual(10);
    }
  });

  test("builds the index lazily when the index file does not exist", async () => {
    const workspaceDir = createTmpDir();
    const docsDir = join(workspaceDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(
      join(docsDir, "guide.md"),
      "# Guide\n\nHandlers are pure functions that return Result values."
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
      ])
    );

    try {
      const indexPath = join(indexDir, "lazy.sqlite");
      const result = await runDocsSearch({
        cwd: workspaceDir,
        query: "handlers",
        outputMode: "json",
        indexPath,
      });

      expect(result.isOk()).toBe(true);
      expect(existsSync(indexPath)).toBe(true);
      if (result.isOk()) {
        expect(result.value.matches.length).toBeGreaterThan(0);
      }
    } finally {
      cleanupTmpDir(workspaceDir);
    }
  });

  test("refreshes the existing workspace index before searching", async () => {
    const workspaceDir = createTmpDir();
    const docsDir = join(workspaceDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    const guidePath = join(docsDir, "guide.md");
    const defaultIndexPath = resolveIndexPath(workspaceDir);
    await Bun.write(guidePath, "# Guide\n\nHandlers return Result values.");
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

    try {
      const firstResult = await runDocsSearch({
        cwd: workspaceDir,
        query: "handlers",
        outputMode: "json",
      });

      expect(firstResult.isOk()).toBe(true);

      await Bun.write(
        guidePath,
        "# Guide\n\nMigration-v0.6 is covered in this updated guide."
      );

      const refreshedResult = await runDocsSearch({
        cwd: workspaceDir,
        query: "migration-v0.6",
        outputMode: "json",
      });

      expect(refreshedResult.isOk()).toBe(true);
      if (refreshedResult.isOk()) {
        expect(refreshedResult.value.total).toBe(1);
        expect(refreshedResult.value.matches[0]?.id).toBe("docs.guide");
      }
    } finally {
      cleanupTmpDir(defaultIndexPath);
      cleanupTmpDir(workspaceDir);
    }
  });

  test("retries punctuation-heavy plain-text queries with quoted FTS terms", async () => {
    const workspaceDir = createTmpDir();
    const docsDir = join(workspaceDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    await Bun.write(
      join(docsDir, "guide.md"),
      "# Guide\n\nMigration-v0.6 and result-api are both documented here."
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
      ])
    );

    try {
      const result = await runDocsSearch({
        cwd: workspaceDir,
        query: "migration-v0.6",
        outputMode: "json",
        indexPath: join(indexDir, "punctuation.sqlite"),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.total).toBe(1);
        expect(result.value.matches[0]?.id).toBe("docs.guide");
      }
    } finally {
      cleanupTmpDir(workspaceDir);
    }
  });
});
