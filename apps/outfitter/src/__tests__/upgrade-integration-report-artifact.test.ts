/**
 * Integration tests for `outfitter upgrade` report artifact behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, mock, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  readUpgradeReport,
  setupUpgradeIntegrationHarness,
  tempDir,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

const originalSpawn = Bun.spawn;

describe("integration: upgrade report artifact", () => {
  test("writes dry_run status with effective flag metadata", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({
      cwd: tempDir,
      dryRun: true,
      yes: true,
      interactive: false,
      all: true,
      noCodemods: true,
      outputMode: "json",
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("dry_run");
    expect(report["applied"]).toBe(false);
    expect(typeof report["startedAt"]).toBe("string");
    expect(typeof report["finishedAt"]).toBe("string");
    expect(report["cwd"]).toBe(resolve(tempDir));

    const flags = report["flags"] as Record<string, unknown>;
    expect(flags["dryRun"]).toBe(true);
    expect(flags["yes"]).toBe(true);
    expect(flags["interactive"]).toBe(false);
    expect(flags["all"]).toBe(true);
    expect(flags["noCodemods"]).toBe(true);
    expect(flags["outputMode"]).toBe("json");
  });

  test("writes no_updates status when no @outfitter packages are found", async () => {
    writePackageJson(tempDir, {
      zod: "^3.0.0",
    });

    mockNpmAndInstall({});

    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("no_updates");
    expect(report["applied"]).toBe(false);
    const summary = report["summary"] as Record<string, unknown>;
    expect(summary["total"]).toBe(0);
    expect(summary["available"]).toBe(0);
  });

  test("writes skipped_non_interactive status when prompts are disabled without --yes", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({
      cwd: tempDir,
      interactive: false,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.applied).toBe(false);

    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("skipped_non_interactive");
  });

  test("writes applied status for successful mutation runs", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpgrade({
      cwd: tempDir,
      yes: true,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.applied).toBe(true);

    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("applied");
    expect(report["applied"]).toBe(true);
    const summary = report["summary"] as Record<string, unknown>;
    expect(summary["applied"]).toBe(1);
  });

  test("writes failed status when upgrade execution errors", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    const failingSpawn = (
      cmd: string[],
      opts?: { cwd?: string; stdout?: string; stderr?: string }
    ) => {
      const cmdArray = Array.isArray(cmd) ? cmd : [cmd];

      if (
        cmdArray[0] === "npm" &&
        cmdArray[1] === "view" &&
        cmdArray[2] === "@outfitter/contracts" &&
        cmdArray[3] === "version"
      ) {
        return {
          stdout: new Response("0.1.5").body,
          stderr: new Response("").body,
          exited: Promise.resolve(0),
        };
      }

      if (cmdArray[0] === "bun" && cmdArray[1] === "install") {
        return {
          stdout: new Response("").body,
          stderr: new Response("install failed").body,
          exited: Promise.resolve(1),
        };
      }

      return originalSpawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
    };

    Object.assign(Bun, { spawn: failingSpawn });

    const result = await runUpgrade({
      cwd: tempDir,
      yes: true,
    });

    expect(result.isErr()).toBe(true);
    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("failed");
    const error = report["error"] as Record<string, unknown>;
    expect(error["message"]).toBe("bun install failed");
    expect(error["category"]).toBe("internal");
  });

  test("writes cancelled status when interactive prompt is declined (non-TTY)", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    // Neither --yes nor --non-interactive → triggers confirmDestructive(),
    // which returns Err(CancelledError) in a non-TTY test environment.
    const result = await runUpgrade({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.applied).toBe(false);

    const report = readUpgradeReport(tempDir);
    expect(report["status"]).toBe("cancelled");
    expect(report["applied"]).toBe(false);
    const summary = report["summary"] as Record<string, unknown>;
    expect(summary["available"]).toBe(1);
    expect(summary["applied"]).toBe(0);
  });

  test("report write failures warn but do not change command result", async () => {
    writePackageJson(tempDir, {
      zod: "^3.0.0",
    });
    mockNpmAndInstall({});

    writeFileSync(join(tempDir, ".outfitter"), "conflicting file");

    const originalStderrWrite = process.stderr.write;
    const stderrSpy = mock(() => true);
    Object.assign(process.stderr, { write: stderrSpy });

    try {
      const result = await runUpgrade({ cwd: tempDir });
      expect(result.isOk()).toBe(true);
      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      Object.assign(process.stderr, { write: originalStderrWrite });
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================
