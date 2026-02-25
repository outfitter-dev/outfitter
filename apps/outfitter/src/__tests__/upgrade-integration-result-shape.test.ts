/**
 * Integration tests for `outfitter upgrade` result-shape behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  setupUpgradeIntegrationHarness,
  tempDir,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

describe("integration: full runUpgrade() flow — result shape", () => {
  test("returns well-formed UpgradeResult with all expected fields", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
      "@outfitter/config": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.2.0",
      "@outfitter/config": "0.1.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;

    // Shape: all required fields exist with correct types
    expect(typeof val.total).toBe("number");
    expect(typeof val.updatesAvailable).toBe("number");
    expect(typeof val.hasBreaking).toBe("boolean");
    expect(typeof val.applied).toBe("boolean");
    expect(Array.isArray(val.packages)).toBe(true);
    expect(Array.isArray(val.appliedPackages)).toBe(true);
    expect(Array.isArray(val.skippedBreaking)).toBe(true);

    // Counts are consistent
    expect(val.total).toBe(3);
    expect(val.packages).toHaveLength(3);

    // Each package has the expected shape
    for (const pkg of val.packages) {
      expect(typeof pkg.name).toBe("string");
      expect(typeof pkg.current).toBe("string");
      expect(typeof pkg.updateAvailable).toBe("boolean");
      expect(typeof pkg.breaking).toBe("boolean");
      expect(pkg.latest === null || typeof pkg.latest === "string").toBe(true);
    }
  });

  test("counts match the package states correctly", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0", // 0.1.0 -> 0.2.0 breaking
      "@outfitter/cli": "^0.1.0", // 0.1.0 -> 0.1.5 non-breaking
      "@outfitter/config": "^0.1.0", // 0.1.0 -> 0.1.0 up-to-date
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.5",
      "@outfitter/config": "0.1.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;

    expect(val.total).toBe(3);
    expect(val.updatesAvailable).toBe(2);
    expect(val.hasBreaking).toBe(true);

    // Non-applied in read-only mode
    expect(val.applied).toBe(false);
    expect(val.appliedPackages).toHaveLength(0);

    // Breaking updates are still tracked in skippedBreaking
    expect(val.skippedBreaking).toContain("@outfitter/contracts");
  });

  test("handles npm lookup failures gracefully", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    // Only provide a version for contracts; cli lookup will "fail"
    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Both packages should be in the result
    expect(result.value.total).toBe(2);

    // The package with a failed lookup should have latest: null
    const cli = result.value.packages.find((p) => p.name === "@outfitter/cli");
    expect(cli).toBeDefined();
    expect(cli?.latest).toBeNull();
    expect(cli?.updateAvailable).toBe(false);
  });
});

// =============================================================================
// Apply Flow — end-to-end with Bun.spawn mock
// =============================================================================
