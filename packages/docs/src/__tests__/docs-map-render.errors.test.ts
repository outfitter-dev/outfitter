import { afterEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { renderLlmsFullFromMap } from "../core/docs-map-render.js";
import {
  makeDocsMap,
  setupTrackedRenderWorkspace,
} from "./docs-map-render-test-helpers.js";
import { cleanupTempRoots } from "./docs-map-test-helpers.js";

describe("renderLlmsFullFromMap error handling", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(workspaceRoots);
  });

  it("throws when docs-map outputPath escapes workspace root", async () => {
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
      "docs/packages/cli/README.md": "# CLI\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "../../secret.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    await expect(renderLlmsFullFromMap(docsMap, workspaceRoot)).rejects.toThrow(
      "outside workspace root"
    );
  });

  it("propagates non-ENOENT read errors", async () => {
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
      "docs/packages/cli/README.md": "# CLI\n",
    });

    await mkdir(join(workspaceRoot, "docs", "packages", "cli", "directory"), {
      recursive: true,
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/directory",
        kind: "readme",
        title: "CLI Dir",
        sourcePath: "packages/cli/docs/directory.md",
        outputPath: "docs/packages/cli/directory",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    await expect(
      renderLlmsFullFromMap(docsMap, workspaceRoot)
    ).rejects.toThrow();
  });
});
