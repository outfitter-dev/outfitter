import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";

import { expectErr, expectOk } from "@outfitter/contracts";
import * as presets from "@outfitter/presets";

import {
  clearResolvedVersionsCache,
  resolvePresetDependencyVersions,
} from "../engine/dependency-versions.js";

afterEach(() => {
  clearResolvedVersionsCache();
});

describe("resolvePresetDependencyVersions", () => {
  test("returns Ok with resolved versions on success", () => {
    const result = resolvePresetDependencyVersions();
    const value = expectOk(result);

    expect(value).toHaveProperty("external");
    expect(value).toHaveProperty("internal");
    expect(typeof value.external).toBe("object");
    expect(typeof value.internal).toBe("object");
  });

  test("cache returns the same value on repeat calls", () => {
    const first = resolvePresetDependencyVersions();
    const second = resolvePresetDependencyVersions();

    const firstValue = expectOk(first);
    const secondValue = expectOk(second);
    expect(firstValue).toBe(secondValue);
  });

  test("clearResolvedVersionsCache invalidates cache", () => {
    const first = resolvePresetDependencyVersions();
    clearResolvedVersionsCache();
    const second = resolvePresetDependencyVersions();

    const firstValue = expectOk(first);
    const secondValue = expectOk(second);
    // After cache clear, a fresh resolution should produce equal but not identical object
    expect(firstValue).toEqual(secondValue);
    expect(firstValue).not.toBe(secondValue);
  });

  test("external versions include expected packages from presets", () => {
    const result = resolvePresetDependencyVersions();
    const value = expectOk(result);

    // Should have some external versions from @outfitter/presets
    expect(Object.keys(value.external).length).toBeGreaterThan(0);
  });

  test("internal versions include @outfitter/* packages", () => {
    const result = resolvePresetDependencyVersions();
    const value = expectOk(result);

    const internalKeys = Object.keys(value.internal);
    expect(internalKeys.length).toBeGreaterThan(0);
    for (const key of internalKeys) {
      expect(key).toMatch(/^@outfitter\//);
    }
  });
});

describe("resolvePresetDependencyVersions failure path", () => {
  test("returns Err with InternalError when package root cannot be found", () => {
    // Mock getResolvedVersions to return valid preset versions (isolate this test
    // from catalog resolution), and existsSync to return false for package.json
    // so findOutfitterPackageRoot fails.
    using _presetsSpy = spyOn(presets, "getResolvedVersions").mockReturnValue({
      all: { typescript: "^5.0.0" },
    });
    using _existsSpy = spyOn(fs, "existsSync").mockReturnValue(false);

    const result = resolvePresetDependencyVersions();
    const error = expectErr(result);

    expect(error.category).toBe("internal");
    expect(error.message).toMatch(/Unable to find outfitter package root/);
  });

  test("returns Err when getResolvedVersions throws", () => {
    using _presetsSpy = spyOn(
      presets,
      "getResolvedVersions"
    ).mockImplementation(() => {
      throw new Error("Catalog resolution failed");
    });

    const result = resolvePresetDependencyVersions();
    const error = expectErr(result);

    expect(error.category).toBe("internal");
    expect(error.message).toMatch(/Catalog resolution failed/);
  });

  test("failure result is not cached — retry is possible", () => {
    // First call fails because getResolvedVersions throws.
    {
      using _presetsSpy = spyOn(
        presets,
        "getResolvedVersions"
      ).mockImplementation(() => {
        throw new Error("Temporary failure");
      });
      const failResult = resolvePresetDependencyVersions();
      expect(failResult.isErr()).toBe(true);
    }

    // Second call succeeds after mock is disposed.
    const successResult = resolvePresetDependencyVersions();
    expect(successResult.isOk()).toBe(true);
  });

  test("never throws — always returns Result", () => {
    // Cause failure by mocking getResolvedVersions
    using _presetsSpy = spyOn(
      presets,
      "getResolvedVersions"
    ).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    // Must not throw, even on failure path
    let threw = false;
    try {
      resolvePresetDependencyVersions();
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  test("never throws even when readFileSync fails", () => {
    // Mock readFileSync to throw, simulating corrupted package.json
    using _readSpy = spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    // Must not throw — returns Result
    let threw = false;
    try {
      resolvePresetDependencyVersions();
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
