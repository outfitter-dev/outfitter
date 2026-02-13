import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getInitTarget,
  getReadyTarget,
  getScaffoldTarget,
  getTarget,
  INIT_TARGET_IDS,
  listTargets,
  READY_TARGET_IDS,
  resolvePlacement,
  SCAFFOLD_TARGET_IDS,
  TARGET_IDS,
  TARGET_REGISTRY,
} from "../index.js";

function findRepoRoot(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 12; i++) {
    const syncScript = join(currentDir, "scripts", "sync-templates.ts");
    if (existsSync(syncScript)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  throw new Error("Unable to locate repository root");
}

describe("target registry", () => {
  test("contains exactly 8 targets", () => {
    expect(TARGET_REGISTRY.size).toBe(8);
    expect(TARGET_IDS.length).toBe(8);
  });

  test("all target IDs are unique", () => {
    expect(new Set(TARGET_IDS).size).toBe(TARGET_IDS.length);
  });

  test("every ready target exists in source and mirrored template directories", () => {
    const repoRoot = findRepoRoot();
    const sourceTemplatesDir = join(repoRoot, "templates");
    const mirroredTemplatesDir = join(
      repoRoot,
      "apps",
      "outfitter",
      "templates"
    );

    for (const id of READY_TARGET_IDS) {
      const target = TARGET_REGISTRY.get(id);
      expect(target).toBeDefined();
      if (!target) {
        continue;
      }
      expect(existsSync(join(sourceTemplatesDir, target.templateDir))).toBe(
        true
      );
      expect(existsSync(join(mirroredTemplatesDir, target.templateDir))).toBe(
        true
      );
    }
  });

  test("getTarget returns Ok for a known target", () => {
    const result = getTarget("cli");
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value.id).toBe("cli");
  });

  test("getTarget supports legacy basic alias", () => {
    const result = getTarget("basic");
    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value.id).toBe("minimal");
  });

  test("getTarget returns NotFoundError for unknown target", () => {
    const result = getTarget("unknown");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("NotFoundError");
    }
  });

  test("getReadyTarget rejects stub targets with clear message", () => {
    const result = getReadyTarget("api");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("ValidationError");
      expect(result.error.message).toContain("not yet available");
    }
  });

  test("getInitTarget allows init-only targets", () => {
    const result = getInitTarget("minimal");
    expect(result.isOk()).toBe(true);
  });

  test("getScaffoldTarget rejects init-only targets", () => {
    const result = getScaffoldTarget("minimal");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("cannot be scaffolded");
    }
  });

  test("placement resolves from category metadata", () => {
    const cli = TARGET_REGISTRY.get("cli");
    const lib = TARGET_REGISTRY.get("lib");

    expect(cli).toBeDefined();
    expect(lib).toBeDefined();
    if (!(cli && lib)) {
      return;
    }

    expect(resolvePlacement(cli)).toBe("apps");
    expect(resolvePlacement(lib)).toBe("packages");
  });

  test("INIT_TARGET_IDS includes only ready init-capable targets", () => {
    for (const id of INIT_TARGET_IDS) {
      const target = TARGET_REGISTRY.get(id);
      expect(target).toBeDefined();
      if (!target) {
        continue;
      }
      expect(target.status).toBe("ready");
      expect(target.scope).not.toBe("scaffold-only");
    }
  });

  test("SCAFFOLD_TARGET_IDS excludes init-only targets", () => {
    for (const id of SCAFFOLD_TARGET_IDS) {
      const target = TARGET_REGISTRY.get(id);
      expect(target).toBeDefined();
      if (!target) {
        continue;
      }
      expect(target.status).toBe("ready");
      expect(target.scope).not.toBe("init-only");
    }
  });

  test("listTargets filters by status", () => {
    const stubs = listTargets({ status: "stub" });
    expect(stubs.length).toBe(4);
    expect(stubs.every((target) => target.status === "stub")).toBe(true);
  });

  test("listTargets filters by category", () => {
    const libraries = listTargets({ category: "library" });
    expect(libraries.every((target) => target.placement === "packages")).toBe(
      true
    );
  });
});
