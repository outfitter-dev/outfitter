/**
 * Optional scaffold end-to-end tests.
 *
 * These tests execute real installs and test runs in generated projects.
 * Enable with OUTFITTER_RUN_SCAFFOLD_E2E=1.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const SCAFFOLD_E2E_ENABLED = process.env["OUTFITTER_RUN_SCAFFOLD_E2E"] === "1";
import {
  DEFAULT_SCAFFOLD_E2E_PRESETS,
  runScaffoldE2ESuite,
} from "../scaffold-e2e/runner.js";
import {
  cleanupScaffoldE2ERunDir,
  createScaffoldE2ERunDir,
  pruneScaffoldE2ERuns,
} from "../scaffold-e2e/workspace.js";

let tempDir: string;

beforeEach(() => {
  pruneScaffoldE2ERuns();
  tempDir = createScaffoldE2ERunDir({
    runLabel: "test",
  });
});

afterEach(() => {
  if (process.env["OUTFITTER_SCAFFOLD_E2E_KEEP"] !== "1") {
    cleanupScaffoldE2ERunDir(tempDir);
  }
});

describe("scaffold e2e verification", () => {
  if (!SCAFFOLD_E2E_ENABLED) {
    test("is disabled unless OUTFITTER_RUN_SCAFFOLD_E2E=1", () => {
      expect(SCAFFOLD_E2E_ENABLED).toBe(false);
    });
    return;
  }

  test(
    "scaffolds each supported preset and runs generated build + tests",
    async () => {
      const results = await runScaffoldE2ESuite({
        runDir: tempDir,
        presets: DEFAULT_SCAFFOLD_E2E_PRESETS,
      });

      expect(results).toHaveLength(DEFAULT_SCAFFOLD_E2E_PRESETS.length);
    },
    { timeout: 600_000 }
  );
});
