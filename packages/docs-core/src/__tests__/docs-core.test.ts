import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPackageDocs, syncPackageDocs } from "../index.js";

async function createWorkspaceFixture(): Promise<string> {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "outfitter-docs-core-test-")
  );

  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await writeFile(join(workspaceRoot, "docs", "PATTERNS.md"), "# Patterns\n");

  const publishablePkgRoot = join(workspaceRoot, "packages", "alpha");
  await mkdir(join(publishablePkgRoot, "docs"), { recursive: true });

  await writeFile(
    join(publishablePkgRoot, "package.json"),
    JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
  );

  await writeFile(
    join(publishablePkgRoot, "README.md"),
    [
      "# Alpha",
      "",
      "See [patterns](../../docs/PATTERNS.md).",
      "",
      "External [site](https://example.com).",
      "",
    ].join("\n")
  );

  await writeFile(join(publishablePkgRoot, "HARVEST_MAP.md"), "# Harvest\n");
  await writeFile(join(publishablePkgRoot, "CHANGELOG.md"), "# Changelog\n");
  await writeFile(
    join(publishablePkgRoot, "docs", "guide.md"),
    ["# Guide", "", "Back to [README](../README.md).", ""].join("\n")
  );

  const privatePkgRoot = join(workspaceRoot, "packages", "private-beta");
  await mkdir(privatePkgRoot, { recursive: true });
  await writeFile(
    join(privatePkgRoot, "package.json"),
    JSON.stringify({
      name: "@acme/private-beta",
      private: true,
      version: "0.0.1",
    })
  );
  await writeFile(join(privatePkgRoot, "README.md"), "# Private\n");

  const missingPkgJsonRoot = join(workspaceRoot, "packages", "no-package-json");
  await mkdir(missingPkgJsonRoot, { recursive: true });
  await writeFile(join(missingPkgJsonRoot, "README.md"), "# No package json\n");

  return workspaceRoot;
}

describe("syncPackageDocs", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("syncs publishable package docs and rewrites relative links", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const result = await syncPackageDocs({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(`expected success: ${result.error.message}`);
    }

    expect(result.value.packageNames).toEqual(["alpha"]);

    const alphaReadmePath = join(
      workspaceRoot,
      "docs",
      "packages",
      "alpha",
      "README.md"
    );

    const alphaReadme = await readFile(alphaReadmePath, "utf8");
    expect(alphaReadme).toContain("[patterns](../../PATTERNS.md)");
    expect(alphaReadme).toContain("[site](https://example.com)");

    expect(
      existsSync(
        join(workspaceRoot, "docs", "packages", "alpha", "HARVEST_MAP.md")
      )
    ).toBe(true);
    expect(
      existsSync(
        join(workspaceRoot, "docs", "packages", "alpha", "docs", "guide.md")
      )
    ).toBe(true);

    expect(
      existsSync(
        join(workspaceRoot, "docs", "packages", "alpha", "CHANGELOG.md")
      )
    ).toBe(false);

    expect(
      existsSync(
        join(workspaceRoot, "docs", "packages", "private-beta", "README.md")
      )
    ).toBe(false);
    expect(
      existsSync(
        join(workspaceRoot, "docs", "packages", "no-package-json", "README.md")
      )
    ).toBe(false);
  });

  it("removes stale generated files on sync", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const initialSync = await syncPackageDocs({ workspaceRoot });
    expect(initialSync.isOk()).toBe(true);

    const stalePath = join(
      workspaceRoot,
      "docs",
      "packages",
      "alpha",
      "STALE.md"
    );
    await writeFile(stalePath, "stale\n");
    expect(existsSync(stalePath)).toBe(true);

    const secondSync = await syncPackageDocs({ workspaceRoot });
    expect(secondSync.isOk()).toBe(true);
    if (secondSync.isErr()) {
      throw new Error(`expected success: ${secondSync.error.message}`);
    }

    expect(existsSync(stalePath)).toBe(false);
    expect(secondSync.value.removedFiles).toContain(
      "docs/packages/alpha/STALE.md"
    );
  });
});

describe("checkPackageDocs", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("reports changed, missing, and unexpected files", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const initialSync = await syncPackageDocs({ workspaceRoot });
    expect(initialSync.isOk()).toBe(true);

    const readmePath = join(
      workspaceRoot,
      "docs",
      "packages",
      "alpha",
      "README.md"
    );
    const harvestPath = join(
      workspaceRoot,
      "docs",
      "packages",
      "alpha",
      "HARVEST_MAP.md"
    );
    const extraPath = join(
      workspaceRoot,
      "docs",
      "packages",
      "alpha",
      "EXTRA.md"
    );

    await writeFile(readmePath, "# Changed\n");
    await rm(harvestPath);
    await writeFile(extraPath, "# Extra\n");

    const check = await checkPackageDocs({ workspaceRoot });

    expect(check.isOk()).toBe(true);
    if (check.isErr()) {
      throw new Error(`expected success: ${check.error.message}`);
    }

    expect(check.value.isUpToDate).toBe(false);
    expect(check.value.drift).toEqual([
      { kind: "changed", path: "docs/packages/alpha/README.md" },
      { kind: "missing", path: "docs/packages/alpha/HARVEST_MAP.md" },
      { kind: "unexpected", path: "docs/packages/alpha/EXTRA.md" },
    ]);
  });
});
