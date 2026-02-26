/**
 * Integration tests for `outfitter upgrade` guide output behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  setupUpgradeIntegrationHarness,
  tempDir,
  writeMigrationDoc,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

describe("integration: guide output via runUpgrade({ guide: true })", () => {
  test("returns migration guides when guide option is set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpgrade({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toBeInstanceOf(Array);
    expect(result.value.guides?.length).toBeGreaterThan(0);

    // Both packages have updates, so both should have guides
    const contractsGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/contracts"
    );
    const cliGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/cli"
    );

    expect(contractsGuide).toBeDefined();
    expect(contractsGuide?.fromVersion).toBe("0.1.0");
    expect(contractsGuide?.toVersion).toBe("0.2.0");
    expect(contractsGuide?.breaking).toBe(true);

    expect(cliGuide).toBeDefined();
    expect(cliGuide?.fromVersion).toBe("0.1.0");
    expect(cliGuide?.toVersion).toBe("0.1.5");
    expect(cliGuide?.breaking).toBe(false);
  });

  test("guides include correct metadata even without local migration docs", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpgrade({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(1);

    expect(result.value.guides?.[0]?.packageName).toBe("@outfitter/contracts");
    expect(result.value.guides?.[0]?.fromVersion).toBe("0.1.0");
    expect(result.value.guides?.[0]?.toVersion).toBe("0.2.0");
    expect(result.value.guides?.[0]?.breaking).toBe(true);
    // steps may or may not be populated depending on whether migration
    // docs are discoverable via parent directory walk
    expect(Array.isArray(result.value.guides?.[0]?.steps)).toBe(true);
  });

  test("guides include migration doc content when docs directory exists", async () => {
    // Create a migration docs directory in the temp project
    const migrationsDir = join(tempDir, "plugins/outfitter/shared/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeMigrationDoc(
      migrationsDir,
      "contracts",
      "0.2.0",
      "Step 1: Update all import paths\n\nStep 2: Run the codemod"
    );

    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpgrade({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(1);

    expect(result.value.guides?.[0]?.packageName).toBe("@outfitter/contracts");
    expect(result.value.guides?.[0]?.breaking).toBe(true);
    expect(result.value.guides?.[0]?.steps.length).toBeGreaterThan(0);
    expect(result.value.guides?.[0]?.steps[0]).toContain(
      "Update all import paths"
    );
  });

  test("guidePackages filters guides to selected package names", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpgrade({
      cwd: tempDir,
      guide: true,
      guidePackages: ["@outfitter/contracts"],
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(1);
    expect(result.value.guides?.[0]?.packageName).toBe("@outfitter/contracts");
  });

  test("guides are not included when guide option is not set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeUndefined();
  });

  test("guides are empty when no packages have updates", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.5",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(0);
  });

  test("guide combined with apply returns both guides and apply result", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking — skipped by apply
      "@outfitter/cli": "0.1.3", // non-breaking — applied
    });

    const result = await runUpgrade({
      cwd: tempDir,
      yes: true,
      guide: true,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Apply results
    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/cli");
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");

    // Guide results
    expect(result.value.guides).toBeDefined();
    expect(result.value.guides?.length).toBeGreaterThan(0);

    const contractsGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/contracts"
    );
    expect(contractsGuide?.breaking).toBe(true);
  });
});

// =============================================================================
// Upgrade Report
// =============================================================================
