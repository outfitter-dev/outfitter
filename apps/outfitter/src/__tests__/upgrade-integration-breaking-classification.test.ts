/**
 * Integration tests for `outfitter upgrade` breaking-classification behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  readPackageJson,
  setupUpgradeIntegrationHarness,
  tempDir,
  writeMigrationDoc,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

describe("integration: breaking classification for pre-1.0 packages", () => {
  test("migration doc breaking:false overrides pre-1.0 semver heuristic", async () => {
    const migrationsDir = join(tempDir, "plugins/outfitter/shared/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeMigrationDoc(
      migrationsDir,
      "types",
      "0.2.0",
      "Version alignment release with no API changes.",
      false
    );

    writePackageJson(tempDir, {
      "@outfitter/types": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/types": "0.2.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const typesPkg = result.value.packages.find(
      (p) => p.name === "@outfitter/types"
    );
    expect(typesPkg).toBeDefined();
    expect(typesPkg?.breaking).toBe(false);
    expect(result.value.hasBreaking).toBe(false);
  });

  test("pre-1.0 minor bump (0.1.0 -> 0.2.0) is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts).toBeDefined();
    expect(contracts?.breaking).toBe(true);
    expect(contracts?.updateAvailable).toBe(true);
    expect(result.value.hasBreaking).toBe(true);
  });

  test("pre-1.0 patch bump (0.1.0 -> 0.1.5) is NOT classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts).toBeDefined();
    expect(contracts?.breaking).toBe(false);
    expect(contracts?.updateAvailable).toBe(true);
    expect(result.value.hasBreaking).toBe(false);
  });

  test("major bump (1.0.0 -> 2.0.0) is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "2.0.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts?.breaking).toBe(true);
    expect(result.value.hasBreaking).toBe(true);
  });

  test("stable minor bump (1.0.0 -> 1.1.0) is NOT classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "1.1.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts?.breaking).toBe(false);
    expect(contracts?.updateAvailable).toBe(true);
  });

  test("0.x to 1.0.0 jump is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/cli": "^0.5.0",
    });

    mockNpmAndInstall({
      "@outfitter/cli": "1.0.0",
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const cli = result.value.packages.find((p) => p.name === "@outfitter/cli");
    expect(cli?.breaking).toBe(true);
  });

  test("mixed breaking and non-breaking across multiple packages", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
      "@outfitter/config": "^1.0.0",
      "@outfitter/logging": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking (pre-1.0 minor)
      "@outfitter/cli": "0.1.5", // non-breaking (patch)
      "@outfitter/config": "2.0.0", // breaking (major)
      "@outfitter/logging": "1.1.0", // non-breaking (stable minor)
    });

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;
    expect(val.total).toBe(4);
    expect(val.updatesAvailable).toBe(4);
    expect(val.hasBreaking).toBe(true);

    // Check individual classifications
    const contracts = val.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    const cli = val.packages.find((p) => p.name === "@outfitter/cli");
    const config = val.packages.find((p) => p.name === "@outfitter/config");
    const logging = val.packages.find((p) => p.name === "@outfitter/logging");

    expect(contracts?.breaking).toBe(true);
    expect(cli?.breaking).toBe(false);
    expect(config?.breaking).toBe(true);
    expect(logging?.breaking).toBe(false);

    // skippedBreaking should list both breaking packages
    expect(val.skippedBreaking).toContain("@outfitter/contracts");
    expect(val.skippedBreaking).toContain("@outfitter/config");
    expect(val.skippedBreaking).not.toContain("@outfitter/cli");
    expect(val.skippedBreaking).not.toContain("@outfitter/logging");
  });
});

// =============================================================================
// Guide Output — structured migration guides
// =============================================================================
