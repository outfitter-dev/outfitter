import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { REGISTRY_CONFIG } from "../registry/build.js";
import { RegistrySchema } from "../registry/schema.js";

/**
 * Tests for the registry build output.
 * These tests validate the generated registry.json.
 */
describe("Registry Build Output", () => {
  const registryPath = join(
    import.meta.dirname,
    "../../registry/registry.json"
  );
  const repoRoot = join(import.meta.dirname, "../../../..");

  function readRegistry() {
    const content = readFileSync(registryPath, "utf-8");
    return RegistrySchema.parse(JSON.parse(content));
  }

  test("registry.json exists", () => {
    expect(existsSync(registryPath)).toBe(true);
  });

  test("registry.json is valid against schema", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
    const result = RegistrySchema.safeParse(registry);
    expect(result.success).toBe(true);
  });

  test("registry contains exactly the configured blocks", () => {
    const registry = readRegistry();
    const actualBlockNames = Object.keys(registry.blocks).toSorted();
    const expectedBlockNames = Object.keys(REGISTRY_CONFIG.blocks).toSorted();
    expect(actualBlockNames).toEqual(expectedBlockNames);
  });

  for (const [name, config] of Object.entries(REGISTRY_CONFIG.blocks)) {
    test(`block "${name}" matches REGISTRY_CONFIG`, () => {
      const registry = readRegistry();
      const block = registry.blocks[name];
      expect(block).toBeDefined();
      if (!block) {
        throw new Error(`Missing block in generated registry: ${name}`);
      }

      if (config.files && config.files.length > 0) {
        const expectedPaths = config.files
          .map((sourcePath) => config.remap?.[sourcePath] ?? sourcePath)
          .toSorted();
        const actualPaths = (block.files ?? [])
          .map((file) => file.path)
          .toSorted();
        expect(actualPaths).toEqual(expectedPaths);
      } else {
        expect(block.files).toBeUndefined();
      }

      if (config.dependencies && Object.keys(config.dependencies).length > 0) {
        expect(block.dependencies).toEqual(config.dependencies);
      } else {
        expect(block.dependencies).toBeUndefined();
      }

      if (
        config.devDependencies &&
        Object.keys(config.devDependencies).length > 0
      ) {
        expect(block.devDependencies).toEqual(config.devDependencies);
      } else {
        expect(block.devDependencies).toBeUndefined();
      }

      if (config.extends && config.extends.length > 0) {
        expect(block.extends).toEqual(config.extends);
        for (const extendedName of config.extends) {
          expect(registry.blocks[extendedName]).toBeDefined();
        }
      } else {
        expect(block.extends).toBeUndefined();
      }
    });
  }

  test("composition blocks do not include direct files", () => {
    const registry = readRegistry();
    for (const [name, config] of Object.entries(REGISTRY_CONFIG.blocks)) {
      if (!config.extends || config.extends.length === 0) {
        continue;
      }

      const block = registry.blocks[name];
      expect(block).toBeDefined();
      expect(block?.files).toBeUndefined();
      expect(block?.extends).toBeDefined();
    }
  });

  test("executable flags match source file permissions", () => {
    const registry = readRegistry();
    for (const [name, config] of Object.entries(REGISTRY_CONFIG.blocks)) {
      if (!config.files) {
        continue;
      }

      const block = registry.blocks[name];
      if (!block) {
        throw new Error(`Missing block in generated registry: ${name}`);
      }
      for (const sourcePath of config.files) {
        const destPath = config.remap?.[sourcePath] ?? sourcePath;
        const fileEntry = block.files?.find((file) => file.path === destPath);
        expect(fileEntry).toBeDefined();

        const sourceFilePath = join(repoRoot, sourcePath);
        const isExecutable = (statSync(sourceFilePath).mode & 0o100) !== 0;
        if (isExecutable) {
          expect(fileEntry?.executable).toBe(true);
        } else {
          expect(fileEntry?.executable).toBeUndefined();
        }
      }
    }
  });

  test("self-referencing tooling version uses caret range", () => {
    const version =
      REGISTRY_CONFIG.blocks.lefthook?.devDependencies?.["@outfitter/tooling"];
    expect(version).toBeDefined();
    expect(version).toMatch(/^\^\d+\.\d+\.\d+$/);
  });

  test("linter block includes the oxlint plugin dependency", () => {
    const version =
      REGISTRY_CONFIG.blocks.linter?.devDependencies?.[
        "@outfitter/oxlint-plugin"
      ];
    expect(version).toBeDefined();
    expect(version).toMatch(/^\^\d+\.\d+\.\d+$/);
  });
});
