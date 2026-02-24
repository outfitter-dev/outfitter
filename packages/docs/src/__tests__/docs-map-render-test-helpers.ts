import type { DocsMap } from "../core/docs-map-schema.js";
import {
  createTrackedWorkspaceRoot,
  writeWorkspaceFiles,
} from "./docs-map-test-helpers.js";

export function makeDocsMap(
  entries: DocsMap["entries"],
  overrides?: Partial<Omit<DocsMap, "entries">>
): DocsMap {
  return {
    generatedAt: "2026-02-21T12:00:00.000Z",
    generator: "@outfitter/docs@0.1.2",
    entries,
    ...overrides,
  };
}

export async function setupTrackedRenderWorkspace(
  roots: Set<string>,
  files: Record<string, string>
): Promise<string> {
  const workspaceRoot = await createTrackedWorkspaceRoot(
    roots,
    "outfitter-llms-full-test-"
  );
  await writeWorkspaceFiles(workspaceRoot, files);
  return workspaceRoot;
}
