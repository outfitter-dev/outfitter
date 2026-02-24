import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  type Manifest,
  ManifestSchema,
  readManifest,
  stampBlock,
  writeManifest,
} from "../manifest.js";

describe("manifest", () => {
  const testDir = join(import.meta.dirname, ".test-manifest-output");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  // =========================================================================
  // readManifest
  // =========================================================================

  describe("readManifest", () => {
    test("returns null for missing manifest", async () => {
      const result = await readManifest(testDir);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
    });

    test("returns parsed manifest for valid file", async () => {
      const manifest: Manifest = {
        version: 1,
        blocks: {
          biome: {
            installedFrom: "0.2.1",
            installedAt: "2026-02-10T00:00:00.000Z",
          },
        },
      };
      mkdirSync(join(testDir, ".outfitter"), { recursive: true });
      writeFileSync(
        join(testDir, ".outfitter/manifest.json"),
        JSON.stringify(manifest)
      );

      const result = await readManifest(testDir);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.version).toBe(1);
        expect(result.value?.blocks["biome"]?.installedFrom).toBe("0.2.1");
      }
    });

    test("returns error for invalid JSON", async () => {
      mkdirSync(join(testDir, ".outfitter"), { recursive: true });
      writeFileSync(
        join(testDir, ".outfitter/manifest.json"),
        "not valid json {{{"
      );

      const result = await readManifest(testDir);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("manifest");
      }
    });

    test("returns error for invalid schema", async () => {
      mkdirSync(join(testDir, ".outfitter"), { recursive: true });
      writeFileSync(
        join(testDir, ".outfitter/manifest.json"),
        JSON.stringify({ version: 99, blocks: "not-an-object" })
      );

      const result = await readManifest(testDir);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("manifest");
      }
    });
  });

  // =========================================================================
  // writeManifest
  // =========================================================================

  describe("writeManifest", () => {
    test("creates .outfitter/ directory if missing", async () => {
      const manifest: Manifest = {
        version: 1,
        blocks: {},
      };

      const result = await writeManifest(testDir, manifest);

      expect(result.isOk()).toBe(true);
      expect(existsSync(join(testDir, ".outfitter"))).toBe(true);
      expect(existsSync(join(testDir, ".outfitter/manifest.json"))).toBe(true);
    });

    test("produces valid JSON matching schema", async () => {
      const manifest: Manifest = {
        version: 1,
        blocks: {
          lefthook: {
            installedFrom: "0.2.1",
            installedAt: "2026-02-10T12:00:00.000Z",
          },
        },
      };

      await writeManifest(testDir, manifest);

      const raw = readFileSync(
        join(testDir, ".outfitter/manifest.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw);

      // Validate against schema
      const validated = ManifestSchema.parse(parsed);
      expect(validated.version).toBe(1);
      expect(validated.blocks["lefthook"]?.installedFrom).toBe("0.2.1");
    });
  });

  // =========================================================================
  // stampBlock
  // =========================================================================

  describe("stampBlock", () => {
    test("creates manifest if missing", async () => {
      const result = await stampBlock(testDir, "biome", "0.2.1");

      expect(result.isOk()).toBe(true);
      expect(existsSync(join(testDir, ".outfitter/manifest.json"))).toBe(true);

      // Verify contents
      const raw = readFileSync(
        join(testDir, ".outfitter/manifest.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw) as Manifest;
      expect(parsed.version).toBe(1);
      expect(parsed.blocks["biome"]?.installedFrom).toBe("0.2.1");
      expect(parsed.blocks["biome"]?.installedAt).toBeDefined();
    });

    test("adds new block to existing manifest", async () => {
      // Write initial manifest with one block
      const initial: Manifest = {
        version: 1,
        blocks: {
          biome: {
            installedFrom: "0.2.0",
            installedAt: "2026-02-09T00:00:00.000Z",
          },
        },
      };
      mkdirSync(join(testDir, ".outfitter"), { recursive: true });
      writeFileSync(
        join(testDir, ".outfitter/manifest.json"),
        JSON.stringify(initial)
      );

      const result = await stampBlock(testDir, "lefthook", "0.2.1");

      expect(result.isOk()).toBe(true);

      const raw = readFileSync(
        join(testDir, ".outfitter/manifest.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw) as Manifest;
      // Original block should still be there
      expect(parsed.blocks["biome"]?.installedFrom).toBe("0.2.0");
      // New block should be added
      expect(parsed.blocks["lefthook"]?.installedFrom).toBe("0.2.1");
    });

    test("updates existing block entry", async () => {
      // Write initial manifest
      const initial: Manifest = {
        version: 1,
        blocks: {
          biome: {
            installedFrom: "0.2.0",
            installedAt: "2026-02-09T00:00:00.000Z",
          },
        },
      };
      mkdirSync(join(testDir, ".outfitter"), { recursive: true });
      writeFileSync(
        join(testDir, ".outfitter/manifest.json"),
        JSON.stringify(initial)
      );

      const result = await stampBlock(testDir, "biome", "0.3.0");

      expect(result.isOk()).toBe(true);

      const raw = readFileSync(
        join(testDir, ".outfitter/manifest.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw) as Manifest;
      expect(parsed.blocks["biome"]?.installedFrom).toBe("0.3.0");
      // installedAt should be updated (not the old timestamp)
      expect(parsed.blocks["biome"]?.installedAt).not.toBe(
        "2026-02-09T00:00:00.000Z"
      );
    });
  });
});
