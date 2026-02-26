import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { applyUpdates } from "../commands/upgrade-apply.js";
import { getLatestVersion } from "../commands/upgrade-latest-version.js";
import { printUpgradeResults } from "../commands/upgrade-output.js";
import { runUpgrade } from "../commands/upgrade.js";

describe("upgrade.ts modularity boundaries", () => {
  const upgradePath = join(import.meta.dir, "..", "commands", "upgrade.ts");
  const source = readFileSync(upgradePath, "utf-8");

  test("keeps orchestration entrypoints in upgrade.ts", () => {
    expect(source).toContain("export async function runUpgrade(");
    expect(source).toContain(
      'export { printUpgradeResults } from "./upgrade-output.js";'
    );
    expect(source).toContain('from "./upgrade-apply.js"');
    expect(source).toContain('from "./upgrade-latest-version.js"');
  });

  test("keeps extracted helper modules importable", () => {
    expect(typeof runUpgrade).toBe("function");
    expect(typeof printUpgradeResults).toBe("function");
    expect(typeof getLatestVersion).toBe("function");
    expect(typeof applyUpdates).toBe("function");
  });
});
