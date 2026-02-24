import { describe, expect, test } from "bun:test";

import {
  getPresetPath,
  getPresetsDir,
  getResolvedVersions,
  listPresets,
} from "../index.ts";

describe("getPresetsDir", () => {
  test("returns an absolute path", () => {
    const dir = getPresetsDir();
    expect(dir).toMatch(/^\//);
  });

  test("returns a path containing 'presets'", () => {
    const dir = getPresetsDir();
    expect(dir).toEndWith("/presets");
  });
});

describe("listPresets", () => {
  test("returns at least one preset", () => {
    const presets = listPresets();
    expect(presets.length).toBeGreaterThan(0);
  });

  test("returns sorted preset names", () => {
    const presets = listPresets();
    const names = presets.map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });

  test("includes known presets", () => {
    const names = listPresets().map((p) => p.name);
    expect(names).toContain("basic");
    expect(names).toContain("minimal");
  });

  test("each preset has name and path", () => {
    for (const preset of listPresets()) {
      expect(preset.name).toBeString();
      expect(preset.path).toMatch(/^\//);
    }
  });
});

describe("getPresetPath", () => {
  test("returns path for existing preset", () => {
    const path = getPresetPath("basic");
    expect(path).toBeDefined();
    expect(path).toMatch(/\/presets\/basic$/);
  });

  test("returns undefined for non-existent preset", () => {
    expect(getPresetPath("does-not-exist")).toBeUndefined();
  });

  test("returns undefined for path traversal input", () => {
    expect(getPresetPath("..")).toBeUndefined();
  });

  test("returns undefined for files (only preset directories are allowed)", () => {
    expect(getPresetPath(".gitkeep")).toBeUndefined();
  });
});

describe("getResolvedVersions", () => {
  test("returns versions object with all field", () => {
    const versions = getResolvedVersions();
    expect(versions).toHaveProperty("all");
    expect(typeof versions.all).toBe("object");
  });

  test("resolves catalog: references from workspace catalog", () => {
    const { all } = getResolvedVersions();
    // These are declared as catalog: in presets package.json
    // and should be resolved from the root catalog
    expect(all["zod"]).toMatch(/^\^?\d+/);
    expect(all["typescript"]).toMatch(/^\^?\d+/);
  });

  test("resolves all declared dependencies", () => {
    const { all } = getResolvedVersions();
    const count = Object.keys(all).length;
    // The presets package declares 15 catalog deps (minus duplicates between deps/devDeps)
    expect(count).toBeGreaterThanOrEqual(14);
  });

  test("versions are semver-like strings", () => {
    const { all } = getResolvedVersions();
    for (const version of Object.values(all)) {
      expect(version).toBeString();
      expect(version.length).toBeGreaterThan(0);
      // Should be a real version, not "catalog:"
      expect(version).not.toBe("catalog:");
    }
  });
});
