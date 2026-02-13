/**
 * Tests for action input mapping behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";

describe("outfitter action mapping", () => {
  test("create action maps CLI input to empty object (retired command)", () => {
    const action = outfitterActions.get("create");
    expect(action).toBeDefined();
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/demo"],
      flags: {
        noTooling: false,
        local: true,
      },
    }) as Record<string, unknown>;

    expect(mapped).toEqual({});
  });

  test("create action returns a migration error message", async () => {
    const action = outfitterActions.get("create");
    expect(action?.handler).toBeDefined();

    const result = await action?.handler?.({} as never);
    expect(result?.isErr()).toBe(true);

    if (result?.isErr()) {
      expect(result.error.message).toContain("removed");
      expect(result.error.message).toContain("outfitter init");
    }
  });

  test("maps scaffold local/workspace aliases to local=true", () => {
    const action = outfitterActions.get("scaffold");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["cli", "demo-tool"],
      flags: {
        workspace: true,
      },
    }) as { local?: boolean | undefined; target: string; name?: string };

    expect(mapped.target).toBe("cli");
    expect(mapped.name).toBe("demo-tool");
    expect(mapped.local).toBe(true);
  });

  test("maps init flags with --tooling and --with", () => {
    const action = outfitterActions.get("init.cli");
    expect(action).toBeDefined();
    expect(action?.cli?.mapInput).toBeDefined();

    const originalArgv = [...process.argv];
    process.argv = [...process.argv, "--tooling"];
    let mapped:
      | {
          noTooling?: boolean | undefined;
          with?: string | undefined;
          targetDir: string;
        }
      | undefined;
    try {
      mapped = action?.cli?.mapInput?.({
        args: ["/tmp/init-cli"],
        flags: {
          tooling: true,
          with: "claude,biome",
        },
      }) as {
        noTooling?: boolean | undefined;
        with?: string | undefined;
        targetDir: string;
      };
    } finally {
      process.argv = originalArgv;
    }

    expect(mapped.targetDir).toBe("/tmp/init-cli");
    expect(mapped.noTooling).toBe(false);
    expect(mapped.with).toBe("claude,biome");
  });
});
