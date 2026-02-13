import { describe, expect, test } from "bun:test";

describe("ensureCiScripts", () => {
  test("adds missing ci scripts without overriding existing scripts", async () => {
    const { ensureCiScripts } = await import("../../scripts/setup-ci.ts");

    const result = ensureCiScripts({
      name: "demo",
      scripts: {
        test: "bun test",
        "ci:test": "custom",
      },
    });

    expect(result.changed).toBe(true);
    expect(result.packageJson.scripts["ci:check"]).toBe("bun run check");
    expect(result.packageJson.scripts["ci:build"]).toBe("bun run build");
    expect(result.packageJson.scripts["ci:test"]).toBe("custom");
  });
});
