import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectPackageDocs } from "../core/package-doc-collection.js";

describe("collectPackageDocs", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("collects publishable package docs and normalizes .mdx outputs", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-package-doc-collection-")
    );
    workspaceRoots.add(workspaceRoot);

    const alphaRoot = join(workspaceRoot, "packages", "alpha");
    await mkdir(join(alphaRoot, "docs"), { recursive: true });
    await writeFile(
      join(alphaRoot, "package.json"),
      JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
    );
    await writeFile(join(alphaRoot, "README.mdx"), "# Alpha\n");
    await writeFile(join(alphaRoot, "docs", "guide.md"), "# Guide\n");
    await writeFile(join(alphaRoot, "CHANGELOG.md"), "# Changelog\n");

    const privateRoot = join(workspaceRoot, "packages", "private-pkg");
    await mkdir(privateRoot, { recursive: true });
    await writeFile(
      join(privateRoot, "package.json"),
      JSON.stringify({ name: "@acme/private-pkg", private: true })
    );
    await writeFile(join(privateRoot, "README.md"), "# Private\n");

    const result = await collectPackageDocs({
      workspaceRoot,
      packagesRoot: join(workspaceRoot, "packages"),
      outputRoot: join(workspaceRoot, "docs", "packages"),
      excludedLowercaseNames: new Set(["changelog.md"]),
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.kind);
    }

    expect(result.value.packageNames).toEqual(["alpha"]);
    expect(result.value.files.map((file) => file.outputPath)).toEqual([
      "docs/packages/alpha/docs/guide.md",
      "docs/packages/alpha/README.md",
    ]);
    expect(result.value.files.map((file) => file.sourcePath)).toEqual([
      "packages/alpha/docs/guide.md",
      "packages/alpha/README.mdx",
    ]);
  });

  it("returns collision error when .md and .mdx resolve to same output path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-package-doc-collision-")
    );
    workspaceRoots.add(workspaceRoot);

    const alphaRoot = join(workspaceRoot, "packages", "alpha");
    await mkdir(join(alphaRoot, "docs"), { recursive: true });
    await writeFile(
      join(alphaRoot, "package.json"),
      JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
    );
    await writeFile(join(alphaRoot, "docs", "guide.md"), "# Guide md\n");
    await writeFile(join(alphaRoot, "docs", "guide.mdx"), "# Guide mdx\n");

    const result = await collectPackageDocs({
      workspaceRoot,
      packagesRoot: join(workspaceRoot, "packages"),
      outputRoot: join(workspaceRoot, "docs", "packages"),
      excludedLowercaseNames: new Set(["changelog.md"]),
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected collision error");
    }

    expect(result.error.kind).toBe("outputPathCollision");
    if (result.error.kind === "outputPathCollision") {
      expect(result.error.outputPath).toBe("docs/packages/alpha/docs/guide.md");
    }
  });

  it("returns outside-workspace error when destination resolves outside workspace", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-package-doc-outside-")
    );
    workspaceRoots.add(workspaceRoot);

    const alphaRoot = join(workspaceRoot, "packages", "alpha");
    await mkdir(alphaRoot, { recursive: true });
    await writeFile(
      join(alphaRoot, "package.json"),
      JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
    );
    await writeFile(join(alphaRoot, "README.md"), "# Alpha\n");

    const result = await collectPackageDocs({
      workspaceRoot,
      packagesRoot: join(workspaceRoot, "packages"),
      outputRoot: join(workspaceRoot, "..", "outside"),
      excludedLowercaseNames: new Set(["changelog.md"]),
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected outside workspace error");
    }

    expect(result.error.kind).toBe("outputPathOutsideWorkspace");
  });
});
