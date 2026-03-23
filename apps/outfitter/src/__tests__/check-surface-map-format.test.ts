import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  runCheckSurfaceMapFormat,
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

describe("runCheckSurfaceMapFormat", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("reports missing-file when surface.lock does not exist", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-format-"));

    const result = await runCheckSurfaceMapFormat({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(false);
      expect(result.value.reason).toBe("missing-file");
    }
  });

  test("passes for a valid 64-char hex hash", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-format-"));
    const lockDir = join(tempDir, ".outfitter");
    await mkdir(lockDir, { recursive: true });
    await writeFile(
      join(lockDir, "surface.lock"),
      "62c1fd1e558df86bdaf14d049b16b0983f050eba511d4aaf31894e0babf414ba\n",
      "utf-8"
    );

    const result = await runCheckSurfaceMapFormat({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(true);
      expect(result.value.reason).toBe("ok");
    }
  });

  test("reports format-drift for an invalid lock file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-format-"));
    const lockDir = join(tempDir, ".outfitter");
    await mkdir(lockDir, { recursive: true });
    await writeFile(
      join(lockDir, "surface.lock"),
      "not-a-valid-hash\n",
      "utf-8"
    );

    const result = await runCheckSurfaceMapFormat({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(false);
      expect(result.value.reason).toBe("format-drift");
    }
  });

  test("reports format-drift for a 63-character hex hash", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "surface-format-"));
    const lockDir = join(tempDir, ".outfitter");
    await mkdir(lockDir, { recursive: true });
    await writeFile(
      join(lockDir, "surface.lock"),
      `${"a".repeat(63)}\n`,
      "utf-8"
    );

    const result = await runCheckSurfaceMapFormat({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.ok).toBe(false);
      expect(result.value.reason).toBe("format-drift");
    }
  });
});
