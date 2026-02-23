import { afterEach, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  generateDocsMap,
  readDocsMap,
  writeDocsMap,
} from "../core/docs-map-generator.js";
import { DocsMapSchema } from "../core/docs-map-schema.js";
import {
  cleanupTempRoots,
  createDocsMapGeneratorWorkspaceFixture,
  createTrackedWorkspaceRoot,
  writeWorkspaceFiles,
} from "./docs-map-test-helpers.js";

describe("writeDocsMap / readDocsMap", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(roots);
  });

  it("roundtrips a docs map through write and read", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) {
      throw new Error(genResult.error.message);
    }

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
    if (writeResult.isErr()) {
      throw new Error(writeResult.error.message);
    }

    expect(writeResult.value).toContain(".outfitter/docs-map.json");

    const readResult = await readDocsMap({ workspaceRoot });
    expect(readResult.isOk()).toBe(true);
    if (readResult.isErr()) {
      throw new Error(readResult.error.message);
    }

    expect(readResult.value.generator).toBe(genResult.value.generator);
    expect(readResult.value.entries.length).toBe(
      genResult.value.entries.length
    );
    expect(readResult.value.entries).toEqual(genResult.value.entries);
  });

  it("writes valid JSON that passes Zod validation", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) {
      throw new Error(genResult.error.message);
    }

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
    if (writeResult.isErr()) {
      throw new Error(writeResult.error.message);
    }

    const raw = await readFile(writeResult.value, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    expect(() => DocsMapSchema.parse(parsed)).not.toThrow();
  });

  it("creates .outfitter/ directory if it does not exist", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-empty-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/minimal/package.json": JSON.stringify({
        name: "@acme/minimal",
        version: "0.0.1",
      }),
      "packages/minimal/README.md": "# Minimal\n",
    });

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) {
      throw new Error(genResult.error.message);
    }

    const writeResult = await writeDocsMap(genResult.value, {
      workspaceRoot,
    });
    expect(writeResult.isOk()).toBe(true);
  });

  it("returns an error when docsMapDir resolves outside workspace root", async () => {
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

    const genResult = await generateDocsMap({ workspaceRoot });
    expect(genResult.isOk()).toBe(true);
    if (genResult.isErr()) {
      throw new Error(genResult.error.message);
    }

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
    const workspaceRoot = await createDocsMapGeneratorWorkspaceFixture(roots);

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
