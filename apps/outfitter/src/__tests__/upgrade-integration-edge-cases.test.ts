/**
 * Integration tests for `outfitter upgrade` edge cases.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  setupUpgradeIntegrationHarness,
  spawnCalls,
  tempDir,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

describe("integration: edge cases", () => {
  test("empty project with no @outfitter/* deps returns zero counts", async () => {
    writePackageJson(tempDir, { zod: "^3.0.0", commander: "^14.0.0" });

    mockNpmAndInstall({});

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.total).toBe(0);
    expect(result.value.updatesAvailable).toBe(0);
    expect(result.value.hasBreaking).toBe(false);
    expect(result.value.packages).toHaveLength(0);
    expect(result.value.applied).toBe(false);
  });

  test("no package.json returns an error result", async () => {
    mockNpmAndInstall({});

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("No package.json found");
    }
  });

  test("all packages up to date with --yes is a no-op", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.5",
      "@outfitter/cli": "^0.1.3",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpgrade({ cwd: tempDir, yes: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.appliedPackages).toHaveLength(0);
    expect(result.value.updatesAvailable).toBe(0);

    // bun install should NOT be called
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(0);
  });

  test("workspace:* protocol deps are excluded from scanning", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "workspace:*",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // workspace:* should be excluded, only cli should appear
    expect(result.value.total).toBe(1);
    expect(result.value.packages[0]?.name).toBe("@outfitter/cli");
  });
});
