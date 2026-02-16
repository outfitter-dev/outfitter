import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  readSurfaceMap,
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
});
