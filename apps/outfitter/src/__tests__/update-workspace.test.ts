/**
 * Tests for workspace-aware scanning in `outfitter update`.
 *
 * Validates workspace root detection, manifest collection,
 * cross-workspace dependency deduplication, and multi-manifest apply.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runUpdate } from "../commands/update.js";
import {
  collectWorkspaceManifests,
  detectWorkspaceRoot,
  getInstalledPackagesFromWorkspace,
} from "../commands/update-workspace.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-update-ws-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
  mock.restore();
});

// =============================================================================
// detectWorkspaceRoot
// =============================================================================

describe("detectWorkspaceRoot", () => {
  test("returns root when package.json has workspaces field", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    const result = detectWorkspaceRoot(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(resolve(tempDir));
    }
  });

  test("detects workspace root from nested directory", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });
    const nested = join(tempDir, "packages", "my-app");
    mkdirSync(nested, { recursive: true });
    writeJson(join(nested, "package.json"), {
      name: "my-app",
      version: "1.0.0",
    });

    const result = detectWorkspaceRoot(nested);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(resolve(tempDir));
    }
  });

  test("returns null result when no workspace root found", () => {
    // Create a simple package.json without workspaces
    writeJson(join(tempDir, "package.json"), {
      name: "standalone",
      version: "1.0.0",
    });

    const result = detectWorkspaceRoot(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeNull();
    }
  });

  test("detects pnpm-workspace.yaml as workspace marker", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "pnpm-monorepo",
    });
    writeFileSync(
      join(tempDir, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n"
    );

    const result = detectWorkspaceRoot(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(resolve(tempDir));
    }
  });

  test("detects yarn workspaces object format", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "yarn-monorepo",
      workspaces: {
        packages: ["packages/*"],
      },
    });

    const result = detectWorkspaceRoot(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(resolve(tempDir));
    }
  });
});

// =============================================================================
// collectWorkspaceManifests
// =============================================================================

describe("collectWorkspaceManifests", () => {
  test("collects package.json files matching workspace patterns", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      devDependencies: { "@outfitter/testing": "^0.1.0" },
    });

    const result = collectWorkspaceManifests(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const paths = result.value;
      expect(paths).toHaveLength(3); // root + 2 packages
      expect(paths).toContain(
        resolve(tempDir, "packages", "pkg-a", "package.json")
      );
      expect(paths).toContain(
        resolve(tempDir, "packages", "pkg-b", "package.json")
      );
      expect(paths).toContain(resolve(tempDir, "package.json"));
    }
  });

  test("handles multiple workspace patterns", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*", "apps/*"],
    });

    writeJson(join(tempDir, "packages", "lib", "package.json"), {
      name: "lib",
    });
    writeJson(join(tempDir, "apps", "web", "package.json"), {
      name: "web",
    });

    const result = collectWorkspaceManifests(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(3); // root + 2
    }
  });

  test("returns only root when no workspace patterns match", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });
    // No packages directory created

    const result = collectWorkspaceManifests(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toBe(resolve(tempDir, "package.json"));
    }
  });

  test("results are sorted deterministically", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "zebra", "package.json"), {
      name: "zebra",
    });
    writeJson(join(tempDir, "packages", "alpha", "package.json"), {
      name: "alpha",
    });

    const result = collectWorkspaceManifests(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const paths = result.value;
      // Should be sorted: root first (package.json), then alphabetically
      expect(paths[0]).toBe(resolve(tempDir, "package.json"));
      expect(paths[1]).toContain("alpha");
      expect(paths[2]).toContain("zebra");
    }
  });
});

// =============================================================================
// getInstalledPackagesFromWorkspace
// =============================================================================

describe("getInstalledPackagesFromWorkspace", () => {
  test("deduplicates @outfitter/* deps across workspace members", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    const result = getInstalledPackagesFromWorkspace(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { packages } = result.value;
      const cliEntries = packages.filter((p) => p.name === "@outfitter/cli");
      // Deduplicated: same version appears once
      expect(cliEntries).toHaveLength(1);
      expect(cliEntries[0]?.version).toBe("0.1.0");
    }
  });

  test("collects packages from all dependency sections", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/cli": "^0.1.0" },
      devDependencies: { "@outfitter/testing": "^0.1.0" },
    });

    const result = getInstalledPackagesFromWorkspace(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const names = result.value.packages.map((p) => p.name);
      expect(names).toContain("@outfitter/cli");
      expect(names).toContain("@outfitter/testing");
    }
  });

  test("reports version conflicts across workspace members", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      dependencies: { "@outfitter/cli": "^0.2.0" },
    });

    const result = getInstalledPackagesFromWorkspace(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.conflicts).toHaveLength(1);
      expect(result.value.conflicts[0]?.name).toBe("@outfitter/cli");
      expect(result.value.conflicts[0]?.versions).toHaveLength(2);
    }
  });

  test("skips workspace:* protocol versions", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
      dependencies: { "@outfitter/contracts": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/contracts": "workspace:*" },
    });

    const result = getInstalledPackagesFromWorkspace(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const contractsEntries = result.value.packages.filter(
        (p) => p.name === "@outfitter/contracts"
      );
      // Only the root's version should appear, workspace:* is skipped
      expect(contractsEntries).toHaveLength(1);
      expect(contractsEntries[0]?.version).toBe("0.1.0");
    }
  });

  test("returns manifest paths for each package occurrence", () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    const result = getInstalledPackagesFromWorkspace(tempDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const { manifestsByPackage } = result.value;
      const cliManifests = manifestsByPackage.get("@outfitter/cli");
      expect(cliManifests).toBeDefined();
      expect(cliManifests).toHaveLength(2);
    }
  });
});

// =============================================================================
// runUpdate with workspace awareness (--apply)
// =============================================================================

// Track Bun.spawn calls for verification
let spawnCalls: Array<{ cmd: string[]; cwd?: string }> = [];
const originalSpawn = Bun.spawn;

function mockNpmAndInstall(versionMap: Record<string, string>): void {
  const mockSpawn = (
    cmd: string[],
    opts?: { cwd?: string; stdout?: string; stderr?: string }
  ) => {
    const cmdArray = Array.isArray(cmd) ? cmd : [cmd];

    if (
      cmdArray[0] === "npm" &&
      cmdArray[1] === "view" &&
      cmdArray[3] === "version"
    ) {
      const pkgName = cmdArray[2] ?? "";
      const version = versionMap[pkgName];

      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });

      if (version) {
        return {
          stdout: new Response(version).body,
          stderr: new Response("").body,
          exited: Promise.resolve(0),
        };
      }
      return {
        stdout: new Response("").body,
        stderr: new Response("Not found").body,
        exited: Promise.resolve(1),
      };
    }

    if (cmdArray[0] === "bun" && cmdArray[1] === "install") {
      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });
      return {
        stdout: new Response("").body,
        stderr: new Response("").body,
        exited: Promise.resolve(0),
      };
    }

    return originalSpawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
  };

  Object.assign(Bun, { spawn: mockSpawn });
}

describe("runUpdate with workspace --apply", () => {
  beforeEach(() => {
    spawnCalls = [];
  });

  afterEach(() => {
    mock.restore();
  });

  test("updates all manifests in a workspace when --apply is used", async () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/cli");

    // Both manifests should be updated
    const pkgA = readJson(
      join(tempDir, "packages", "pkg-a", "package.json")
    ) as {
      dependencies?: Record<string, string>;
    };
    const pkgB = readJson(
      join(tempDir, "packages", "pkg-b", "package.json")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(pkgA.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
    expect(pkgB.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
  });

  test("runs bun install once at workspace root", async () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      version: "1.0.0",
      devDependencies: { "@outfitter/testing": "^0.1.0" },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
      "@outfitter/testing": "0.1.2",
    });

    await runUpdate({ cwd: tempDir, apply: true });

    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    // Should only run once at the root
    expect(installCalls).toHaveLength(1);
    expect(installCalls[0]?.cwd).toBe(resolve(tempDir));
  });

  test("non-workspace single package behavior unchanged", async () => {
    writeJson(join(tempDir, "package.json"), {
      name: "standalone",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);

    const pkg = readJson(join(tempDir, "package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");

    // Install should run at cwd (the standalone package root)
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(1);
  });

  test("detects workspace from nested cwd", async () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    const nestedDir = join(tempDir, "packages", "pkg-a");
    writeJson(join(nestedDir, "package.json"), {
      name: "pkg-a",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    // Run from nested package directory
    const result = await runUpdate({ cwd: nestedDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);

    // Both manifests should still be updated (workspace-wide)
    const pkgA = readJson(join(nestedDir, "package.json")) as {
      dependencies?: Record<string, string>;
    };
    const pkgB = readJson(
      join(tempDir, "packages", "pkg-b", "package.json")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(pkgA.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
    expect(pkgB.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
  });

  test("read-only mode scans workspace but does not write", async () => {
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    // No --apply
    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.updatesAvailable).toBe(1);

    // package.json should be unchanged
    const pkgA = readJson(
      join(tempDir, "packages", "pkg-a", "package.json")
    ) as {
      dependencies?: Record<string, string>;
    };
    expect(pkgA.dependencies?.["@outfitter/cli"]).toBe("^0.1.0");
  });
});
