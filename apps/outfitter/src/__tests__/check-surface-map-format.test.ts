import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { generateSurfaceMap, writeSurfaceMap } from "@outfitter/schema";
import { z } from "zod";

import {
  canonicalizeJson,
  checkSurfaceMapFormat,
} from "../commands/check-surface-map-format.js";

describe("checkSurfaceMapFormat", () => {
  test("passes for oxfmt-canonical JSON with trailing newline", () => {
    const canonical = '{\n  "a": 1,\n  "b": [1, 2]\n}\n';

    const result = checkSurfaceMapFormat(canonical, "/tmp/surface.json");

    expect(result.ok).toBe(true);
  });

  test("fails for multiline-array formatting drift", () => {
    const nonCanonical = '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n';

    const result = checkSurfaceMapFormat(nonCanonical, "/tmp/surface.json");

    expect(result.ok).toBe(false);
    expect(result.expected).toBe(
      canonicalizeJson(nonCanonical, "/tmp/surface.json")
    );
  });

  test("passes for surface maps written by @outfitter/schema", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "surface-format-"));
    const filePath = join(tempDir, "surface.json");
    const registry = createActionRegistry().add(
      defineAction({
        id: "doctor",
        description: "Validate environment",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "doctor" },
        handler: async () => Result.ok({ ok: true }),
      })
    );

    try {
      await writeSurfaceMap(
        generateSurfaceMap(registry, { generator: "build" }),
        filePath
      );

      const content = await readFile(filePath, "utf-8");
      const result = checkSurfaceMapFormat(content, filePath);

      expect(result.ok).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
