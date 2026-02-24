import { afterEach, describe, expect, it } from "bun:test";
import { generateDocsMap } from "../core/docs-map-generator.js";
import {
  cleanupTempRoots,
  createTrackedWorkspaceRoot,
  writeWorkspaceFiles,
} from "./docs-map-test-helpers.js";

describe("doc kind inference", () => {
  const roots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(roots);
  });

  it("classifies architecture docs", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-kind-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/test-pkg/package.json": JSON.stringify({
        name: "@acme/test-pkg",
        version: "0.0.1",
      }),
      "packages/test-pkg/README.md": "# Test\n",
      "packages/test-pkg/docs/architecture.md": "# Architecture\n",
      "packages/test-pkg/docs/conventions.md": "# Conventions\n",
    });

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const archEntry = result.value.entries.find((entry) =>
      entry.sourcePath.includes("architecture.md")
    );
    expect(archEntry?.kind).toBe("architecture");

    const conventionEntry = result.value.entries.find((entry) =>
      entry.sourcePath.includes("conventions.md")
    );
    expect(conventionEntry?.kind).toBe("convention");
  });

  it("classifies guide and reference docs in docs/ by filename", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-kind-guideref-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/typed-pkg/package.json": JSON.stringify({
        name: "@acme/typed-pkg",
        version: "0.0.1",
      }),
      "packages/typed-pkg/README.md": "# Typed\n",
      "packages/typed-pkg/docs/getting-started.md": "# Getting Started\n",
      "packages/typed-pkg/docs/api-reference.md": "# API Reference\n",
    });

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const guideEntry = result.value.entries.find((entry) =>
      entry.sourcePath.endsWith("docs/getting-started.md")
    );
    expect(guideEntry?.kind).toBe("guide");

    const referenceEntry = result.value.entries.find((entry) =>
      entry.sourcePath.endsWith("docs/api-reference.md")
    );
    expect(referenceEntry?.kind).toBe("reference");
  });

  it("does not classify filenames containing api as a substring as reference", async () => {
    const workspaceRoot = await createTrackedWorkspaceRoot(
      roots,
      "outfitter-docs-map-kind-api-substring-test-"
    );

    await writeWorkspaceFiles(workspaceRoot, {
      "packages/substring-pkg/package.json": JSON.stringify({
        name: "@acme/substring-pkg",
        version: "0.0.1",
      }),
      "packages/substring-pkg/README.md": "# Substring\n",
      "packages/substring-pkg/docs/rapid-deployment.md": "# Rapid Deployment\n",
    });

    const result = await generateDocsMap({ workspaceRoot });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    const entry = result.value.entries.find((candidate) =>
      candidate.sourcePath.endsWith("docs/rapid-deployment.md")
    );
    expect(entry?.kind).toBe("deep");
  });
});
