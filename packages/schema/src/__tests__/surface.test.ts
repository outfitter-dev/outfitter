import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import type { SurfaceMap } from "../surface.js";
import {
  generateSurfaceMap,
  hashSurfaceMap,
  readSurfaceLock,
  readSurfaceMap,
  writeSurfaceLock,
  writeSurfaceMap,
} from "../surface.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestRegistry() {
  return createActionRegistry()
    .add(
      defineAction({
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: z.object({
          name: z.string().optional(),
        }),
        cli: {
          command: "init [name]",
          description: "Create a new project",
        },
        handler: async () => Result.ok({ ok: true }),
      })
    )
    .add(
      defineAction({
        id: "doctor",
        description: "Validate environment",
        surfaces: ["cli", "mcp"],
        input: z.object({}),
        cli: { command: "doctor" },
        mcp: { tool: "doctor" },
        handler: async () => Result.ok({ ok: true }),
      })
    );
}

// =============================================================================
// generateSurfaceMap
// =============================================================================

describe("generateSurfaceMap", () => {
  it("returns a SurfaceMap with $schema and generator fields", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    expect(surfaceMap.$schema).toBe("https://outfitter.dev/surface/v1");
    expect(surfaceMap.generator).toBe("runtime");
  });

  it("generates from build mode", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry, { generator: "build" });

    expect(surfaceMap.generator).toBe("build");
  });

  it("includes all manifest fields", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    expect(surfaceMap.version).toBe("1.0.0");
    expect(surfaceMap.generatedAt).toBeTruthy();
    expect(surfaceMap.actions.length).toBe(2);
    expect(surfaceMap.surfaces).toContain("cli");
    expect(surfaceMap.errors).toBeDefined();
    expect(surfaceMap.outputModes).toBeDefined();
  });

  it("passes through manifest options", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry, {
      version: "2.0.0",
      surface: "mcp",
    });

    expect(surfaceMap.version).toBe("2.0.0");
    expect(surfaceMap.actions.length).toBe(1);
  });
});

// =============================================================================
// writeSurfaceMap / readSurfaceMap
// =============================================================================

describe("surface map I/O", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes and reads a surface map", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const outputPath = join(tempDir, ".outfitter", "surface.json");
    await writeSurfaceMap(surfaceMap, outputPath);

    const read = await readSurfaceMap(outputPath);
    expect(read.$schema).toBe(surfaceMap.$schema);
    expect(read.generator).toBe(surfaceMap.generator);
    expect(read.actions.length).toBe(surfaceMap.actions.length);
  });

  it("creates parent directories if needed", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const deepPath = join(tempDir, "deep", "nested", "surface.json");
    await writeSurfaceMap(surfaceMap, deepPath);

    const content = await readFile(deepPath, "utf-8");
    const parsed = JSON.parse(content) as SurfaceMap;
    expect(parsed.$schema).toBe("https://outfitter.dev/surface/v1");
  });

  it("writes pretty-printed JSON", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const outputPath = join(tempDir, "surface.json");
    await writeSurfaceMap(surfaceMap, outputPath);

    const content = await readFile(outputPath, "utf-8");
    // Pretty-printed JSON has newlines
    expect(content).toContain("\n");
    // Ends with newline
    expect(content.endsWith("\n")).toBe(true);
  });

  it("writes to snapshot path", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const snapshotPath = join(
      tempDir,
      ".outfitter",
      "snapshots",
      "v1.0.0.json"
    );
    await writeSurfaceMap(surfaceMap, snapshotPath);

    const read = await readSurfaceMap(snapshotPath);
    expect(read.version).toBe("1.0.0");
  });

  it("preserves the existing generatedAt when the surface content is unchanged", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const outputPath = join(tempDir, ".outfitter", "surface.json");
    const initialSurfaceMap = {
      ...generateSurfaceMap(registry, { generator: "build" }),
      generatedAt: "2026-03-01T00:00:00.000Z",
    };

    await writeSurfaceMap(initialSurfaceMap, outputPath);
    const initialContent = await readFile(outputPath, "utf-8");

    await writeSurfaceMap(
      generateSurfaceMap(registry, { generator: "build" }),
      outputPath
    );

    const rewrittenContent = await readFile(outputPath, "utf-8");
    const rewrittenMap = await readSurfaceMap(outputPath);

    expect(rewrittenMap.generatedAt).toBe(initialSurfaceMap.generatedAt);
    expect(rewrittenContent).toBe(initialContent);
  });

  it("treats semantically equivalent surface maps as unchanged even when key order differs", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-"));
    const registry = createTestRegistry();
    const outputPath = join(tempDir, ".outfitter", "surface.json");
    const generatedSurfaceMap = generateSurfaceMap(registry, {
      generator: "build",
    });
    const existingGeneratedAt = "2026-03-01T00:00:00.000Z";

    await mkdir(join(tempDir, ".outfitter"), { recursive: true });
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          version: generatedSurfaceMap.version,
          surfaces: generatedSurfaceMap.surfaces,
          actions: generatedSurfaceMap.actions,
          errors: generatedSurfaceMap.errors,
          outputModes: generatedSurfaceMap.outputModes,
          $schema: generatedSurfaceMap.$schema,
          generator: generatedSurfaceMap.generator,
          generatedAt: existingGeneratedAt,
        },
        null,
        2
      )
    );

    await writeSurfaceMap(generatedSurfaceMap, outputPath);

    const rewrittenMap = await readSurfaceMap(outputPath);
    expect(rewrittenMap.generatedAt).toBe(existingGeneratedAt);
  });
});

// =============================================================================
// hashSurfaceMap
// =============================================================================

describe("hashSurfaceMap", () => {
  it("returns a 64-character hex SHA-256 hash", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const hash = hashSurfaceMap(surfaceMap);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output ignoring generatedAt", () => {
    const registry = createTestRegistry();
    const map1 = {
      ...generateSurfaceMap(registry),
      generatedAt: "2026-01-01T00:00:00.000Z",
    };
    const map2 = {
      ...generateSurfaceMap(registry),
      generatedAt: "2026-12-31T23:59:59.999Z",
    };

    expect(hashSurfaceMap(map1)).toBe(hashSurfaceMap(map2));
  });

  it("produces the same hash regardless of generator mode", () => {
    const registry = createTestRegistry();
    const buildMap = generateSurfaceMap(registry, { generator: "build" });
    const runtimeMap = generateSurfaceMap(registry, { generator: "runtime" });

    expect(hashSurfaceMap(buildMap)).toBe(hashSurfaceMap(runtimeMap));
  });

  it("produces different hashes for different content", () => {
    const registry1 = createTestRegistry();
    const map1 = generateSurfaceMap(registry1);

    const registry2 = createActionRegistry().add(
      defineAction({
        id: "different",
        description: "Different action",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "different" },
        handler: async () => Result.ok({ ok: true }),
      })
    );
    const map2 = generateSurfaceMap(registry2);

    expect(hashSurfaceMap(map1)).not.toBe(hashSurfaceMap(map2));
  });

  it("produces the same hash regardless of key order", () => {
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);

    const reordered = {
      generator: surfaceMap.generator,
      $schema: surfaceMap.$schema,
      actions: surfaceMap.actions,
      version: surfaceMap.version,
      generatedAt: surfaceMap.generatedAt,
      surfaces: surfaceMap.surfaces,
      errors: surfaceMap.errors,
      outputModes: surfaceMap.outputModes,
    } as SurfaceMap;

    expect(hashSurfaceMap(reordered)).toBe(hashSurfaceMap(surfaceMap));
  });
});

// =============================================================================
// writeSurfaceLock / readSurfaceLock
// =============================================================================

describe("surface lock I/O", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes a lock file containing only a hex hash and trailing newline", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-lock-"));
    const lockPath = join(tempDir, ".outfitter", "surface.lock");

    await writeSurfaceLock("abc123def456", lockPath);

    const content = await readFile(lockPath, "utf-8");
    expect(content).toBe("abc123def456\n");
  });

  it("reads a lock file and returns the hash string", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-lock-"));
    const lockPath = join(tempDir, ".outfitter", "surface.lock");
    await mkdir(join(tempDir, ".outfitter"), { recursive: true });
    await writeFile(lockPath, "abc123def456\n", "utf-8");

    const hash = await readSurfaceLock(lockPath);

    expect(hash).toBe("abc123def456");
  });

  it("trims whitespace when reading the lock file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-lock-"));
    const lockPath = join(tempDir, ".outfitter", "surface.lock");
    await mkdir(join(tempDir, ".outfitter"), { recursive: true });
    await writeFile(lockPath, "  abc123def456  \n", "utf-8");

    const hash = await readSurfaceLock(lockPath);

    expect(hash).toBe("abc123def456");
  });

  it("creates parent directories when writing", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-lock-"));
    const lockPath = join(tempDir, "deep", "nested", "surface.lock");

    await writeSurfaceLock("abc123", lockPath);

    const content = await readFile(lockPath, "utf-8");
    expect(content).toBe("abc123\n");
  });

  it("roundtrips with hashSurfaceMap", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-lock-"));
    const registry = createTestRegistry();
    const surfaceMap = generateSurfaceMap(registry);
    const hash = hashSurfaceMap(surfaceMap);

    const lockPath = join(tempDir, ".outfitter", "surface.lock");
    await writeSurfaceLock(hash, lockPath);
    const readHash = await readSurfaceLock(lockPath);

    expect(readHash).toBe(hash);
  });
});
