import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cleanupScaffoldE2ERunDir,
  createScaffoldE2ERunDir,
  pruneScaffoldE2ERuns,
} from "../scaffold-e2e/workspace.js";

function createHarnessRoot(): string {
  const root = join(
    tmpdir(),
    `outfitter-scaffold-e2e-workspace-test-${Date.now()}`
  );
  mkdirSync(root, { recursive: true });
  return root;
}

describe("scaffold e2e workspace management", () => {
  test("creates run directories under a managed root and cleans them up", () => {
    const rootDir = createHarnessRoot();

    try {
      const runDir = createScaffoldE2ERunDir({
        rootDir,
        runLabel: "cli",
      });

      expect(runDir.startsWith(rootDir)).toBe(true);
      expect(runDir).toContain("cli");
      expect(existsSync(runDir)).toBe(true);

      cleanupScaffoldE2ERunDir(runDir);

      expect(existsSync(runDir)).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("prunes only stale managed run directories by default", () => {
    const rootDir = createHarnessRoot();
    const now = Date.UTC(2026, 2, 9, 12, 0, 0);
    const staleDir = join(rootDir, "20260308T010000-old-cli");
    const freshDir = join(rootDir, "20260309T110000-new-library");
    const unrelatedDir = join(rootDir, "notes");

    mkdirSync(staleDir, { recursive: true });
    mkdirSync(freshDir, { recursive: true });
    mkdirSync(unrelatedDir, { recursive: true });

    try {
      const result = pruneScaffoldE2ERuns({
        rootDir,
        now,
        maxAgeMs: 60 * 60 * 1000,
      });

      expect(result.removed.map((dir) => dir.path)).toEqual([staleDir]);
      expect(result.kept.map((dir) => dir.path)).toEqual([freshDir]);
      expect(existsSync(staleDir)).toBe(false);
      expect(existsSync(freshDir)).toBe(true);
      expect(existsSync(unrelatedDir)).toBe(true);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("can nuke every managed scaffold run when requested", () => {
    const rootDir = createHarnessRoot();
    const firstRun = join(rootDir, "20260309T080000-cli");
    const secondRun = join(rootDir, "20260309T090000-library");

    mkdirSync(firstRun, { recursive: true });
    mkdirSync(secondRun, { recursive: true });

    try {
      const result = pruneScaffoldE2ERuns({
        rootDir,
        removeAll: true,
      });

      expect(result.removed.map((dir) => dir.path).toSorted()).toEqual(
        [firstRun, secondRun].toSorted()
      );
      expect(existsSync(firstRun)).toBe(false);
      expect(existsSync(secondRun)).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
