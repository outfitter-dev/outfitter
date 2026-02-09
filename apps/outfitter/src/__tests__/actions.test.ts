/**
 * Tests for action input mapping behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";

describe("outfitter action mapping", () => {
  test("maps create --no-tooling to noTooling=true", () => {
    const action = outfitterActions.get("create");
    expect(action).toBeDefined();
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/demo"],
      flags: {
        noTooling: false,
      },
    }) as { noTooling?: boolean | undefined; targetDir: string };

    expect(mapped.targetDir).toBe("/tmp/demo");
    expect(mapped.noTooling).toBe(true);
  });

  test("maps create --tooling to noTooling=false", () => {
    const action = outfitterActions.get("create");
    expect(action?.cli?.mapInput).toBeDefined();

    const originalArgv = [...process.argv];
    process.argv = [...process.argv, "--tooling"];
    let mapped: { noTooling?: boolean | undefined } | undefined;
    try {
      mapped = action?.cli?.mapInput?.({
        args: ["/tmp/demo"],
        flags: {
          tooling: true,
        },
      }) as { noTooling?: boolean | undefined };
    } finally {
      process.argv = originalArgv;
    }

    expect(mapped.noTooling).toBe(false);
  });

  test("does not force create noTooling when flag omitted", () => {
    const action = outfitterActions.get("create");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/demo"],
      flags: {},
    }) as { noTooling?: boolean | undefined };

    expect(mapped.noTooling).toBeUndefined();
  });

  test("preserves create local as undefined when flag omitted", () => {
    const action = outfitterActions.get("create");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/demo"],
      flags: {},
    }) as { local?: boolean | undefined };

    expect(mapped.local).toBeUndefined();
  });

  test("maps create local/workspace aliases to local=true", () => {
    const action = outfitterActions.get("create");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/demo"],
      flags: {
        workspace: true,
      },
    }) as { local?: boolean | undefined };

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
