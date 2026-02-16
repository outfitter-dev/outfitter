import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { diffSurfaceMaps } from "../diff.js";
import {
  generateSurfaceMap,
  readSurfaceMap,
  resolveSnapshotPath,
} from "../surface.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const tmpDir = join(import.meta.dir, "__tmp_snapshot_diff__");

function createV1Registry() {
  return createActionRegistry().add(
    defineAction({
      id: "init",
      description: "Create a new project",
      surfaces: ["cli"],
      input: z.object({ name: z.string().optional() }),
      cli: { command: "init [name]", description: "Create a new project" },
      handler: async () => Result.ok({ ok: true }),
    })
  );
}

function createV2Registry() {
  return createActionRegistry()
    .add(
      defineAction({
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: z.object({
          name: z.string().optional(),
          force: z.boolean().optional(),
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
        id: "check",
        description: "Run checks",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "check" },
        handler: async () => Result.ok({ ok: true }),
      })
    );
}

function writeSnapshot(
  version: string,
  registry: ReturnType<typeof createV1Registry>
) {
  const map = generateSurfaceMap(registry, { generator: "build" });
  const snapshotPath = resolveSnapshotPath(tmpDir, ".outfitter", version);
  mkdirSync(join(tmpDir, ".outfitter", "snapshots"), { recursive: true });
  writeFileSync(snapshotPath, JSON.stringify(map, null, 2));
  return snapshotPath;
}

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// resolveSnapshotPath
// =============================================================================

describe("resolveSnapshotPath", () => {
  it("resolves to .outfitter/snapshots/<version>.json", () => {
    const path = resolveSnapshotPath("/project", ".outfitter", "v1.0.0");
    expect(path).toBe("/project/.outfitter/snapshots/v1.0.0.json");
  });

  it("works with custom outputDir", () => {
    const path = resolveSnapshotPath("/project", ".custom", "v2");
    expect(path).toBe("/project/.custom/snapshots/v2.json");
  });
});

// =============================================================================
// Snapshot-to-runtime diff (--against)
// =============================================================================

describe("snapshot-to-runtime diff", () => {
  it("detects changes between snapshot and runtime", async () => {
    writeSnapshot("v1", createV1Registry());

    const snapshotPath = resolveSnapshotPath(tmpDir, ".outfitter", "v1");
    const committed = await readSurfaceMap(snapshotPath);
    const current = generateSurfaceMap(createV2Registry(), {
      generator: "runtime",
    });
    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe("check");
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.id).toBe("init");
  });

  it("reports no changes when snapshot matches runtime", async () => {
    writeSnapshot("v1", createV1Registry());

    const snapshotPath = resolveSnapshotPath(tmpDir, ".outfitter", "v1");
    const committed = await readSurfaceMap(snapshotPath);
    const current = generateSurfaceMap(createV1Registry(), {
      generator: "runtime",
    });
    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(false);
  });
});

// =============================================================================
// Snapshot-to-snapshot diff (--from / --to)
// =============================================================================

describe("snapshot-to-snapshot diff", () => {
  it("detects changes between two snapshots", async () => {
    writeSnapshot("v1", createV1Registry());
    writeSnapshot("v2", createV2Registry());

    const fromPath = resolveSnapshotPath(tmpDir, ".outfitter", "v1");
    const toPath = resolveSnapshotPath(tmpDir, ".outfitter", "v2");
    const from = await readSurfaceMap(fromPath);
    const to = await readSurfaceMap(toPath);
    const diff = diffSurfaceMaps(from, to);

    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe("check");
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.id).toBe("init");
  });

  it("reports no changes between identical snapshots", async () => {
    writeSnapshot("v1", createV1Registry());
    writeSnapshot("v1-copy", createV1Registry());

    const fromPath = resolveSnapshotPath(tmpDir, ".outfitter", "v1");
    const toPath = resolveSnapshotPath(tmpDir, ".outfitter", "v1-copy");
    const from = await readSurfaceMap(fromPath);
    const to = await readSurfaceMap(toPath);
    const diff = diffSurfaceMaps(from, to);

    expect(diff.hasChanges).toBe(false);
  });
});
