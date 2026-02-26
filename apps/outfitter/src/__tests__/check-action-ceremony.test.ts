import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { runCheckActionCeremony } from "../commands/check-action-ceremony.js";

const workspaceRoot = resolve(import.meta.dir, "../../../..");

describe("check action ceremony", () => {
  test("current action ceremony stays within configured budgets", async () => {
    const result = await runCheckActionCeremony({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.ok).toBe(true);
    expect(result.value.budgets).toHaveLength(3);
  });
});
