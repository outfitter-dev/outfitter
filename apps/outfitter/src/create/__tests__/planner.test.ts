import { describe, expect, test } from "bun:test";
import { planCreateProject } from "../planner.js";

describe("create planner", () => {
  test("builds a deterministic plan for a preset", () => {
    const result = planCreateProject({
      name: "hello-cli",
      targetDir: "/tmp/hello-cli",
      preset: "cli",
      year: "2026",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.preset.id).toBe("cli");
    expect(result.value.values).toEqual({
      packageName: "hello-cli",
      projectName: "hello-cli",
      version: "0.1.0",
      description: "A new project created with Outfitter",
      binName: "hello-cli",
      year: "2026",
    });
    expect(result.value.changes).toEqual([
      {
        type: "copy-template",
        template: "cli",
        targetDir: "/tmp/hello-cli",
        overlayBaseTemplate: true,
      },
      { type: "inject-shared-config" },
      { type: "add-blocks", blocks: ["scaffolding"] },
    ]);
  });

  test("adds local dependency rewrite when local mode is enabled", () => {
    const result = planCreateProject({
      name: "local-app",
      targetDir: "/tmp/local-app",
      preset: "basic",
      local: true,
      year: "2026",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.changes).toContainEqual({
      type: "rewrite-local-dependencies",
      mode: "workspace",
    });
  });

  test("omits tooling blocks when includeTooling is false", () => {
    const result = planCreateProject({
      name: "no-tooling",
      targetDir: "/tmp/no-tooling",
      preset: "mcp",
      includeTooling: false,
      year: "2026",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(
      result.value.changes.find((change) => change.type === "add-blocks")
    ).toBeUndefined();
  });

  test("derives scoped project and bin names from packageName", () => {
    const result = planCreateProject({
      name: "ignored-name",
      packageName: "@outfitter/my-mcp",
      targetDir: "/tmp/my-mcp",
      preset: "mcp",
      year: "2026",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.values.projectName).toBe("my-mcp");
    expect(result.value.values.binName).toBe("my-mcp");
  });

  test("rejects packageName with missing scoped segment", () => {
    const result = planCreateProject({
      name: "@",
      targetDir: "/tmp/invalid-scoped",
      preset: "basic",
      year: "2026",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("packageName");
    }
  });

  test("rejects packageName with empty scoped name segment", () => {
    const result = planCreateProject({
      name: "ignored-name",
      packageName: "@outfitter/",
      targetDir: "/tmp/invalid-scoped-slug",
      preset: "mcp",
      year: "2026",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("packageName");
    }
  });

  test("returns validation error for unknown preset input", () => {
    const result = planCreateProject({
      name: "valid-name",
      targetDir: "/tmp/unknown-preset",
      preset: "unknown" as unknown as "basic",
      year: "2026",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("preset");
    }
  });

  test("returns validation error when required inputs are empty", () => {
    const emptyName = planCreateProject({
      name: "   ",
      targetDir: "/tmp/empty-name",
      preset: "basic",
    });
    expect(emptyName.isErr()).toBe(true);

    const emptyDir = planCreateProject({
      name: "valid-name",
      targetDir: "   ",
      preset: "basic",
    });
    expect(emptyDir.isErr()).toBe(true);
  });
});
