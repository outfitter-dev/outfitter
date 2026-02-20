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

  test("maps upgrade --no-codemods across commander flag shapes", () => {
    const action = outfitterActions.get("upgrade");
    expect(action?.cli?.mapInput).toBeDefined();

    const mappedKebab = action?.cli?.mapInput?.({
      args: [],
      flags: { "no-codemods": true },
    }) as { noCodemods: boolean };
    expect(mappedKebab.noCodemods).toBe(true);

    const mappedCamel = action?.cli?.mapInput?.({
      args: [],
      flags: { noCodemods: true },
    }) as { noCodemods: boolean };
    expect(mappedCamel.noCodemods).toBe(true);

    const mappedPositive = action?.cli?.mapInput?.({
      args: [],
      flags: { codemods: false },
    }) as { noCodemods: boolean };
    expect(mappedPositive.noCodemods).toBe(true);

    const mappedDefault = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { noCodemods: boolean };
    expect(mappedDefault.noCodemods).toBe(false);
  });

  test("maps init shared flags from preset adapters", () => {
    const action = outfitterActions.get("init");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/init"],
      flags: {
        force: true,
        dryRun: true,
        yes: true,
      },
    }) as { force: boolean; dryRun: boolean; yes: boolean };

    expect(mapped.force).toBe(true);
    expect(mapped.dryRun).toBe(true);
    expect(mapped.yes).toBe(true);
  });

  test("exposes library preset in init action options and preset subcommand", () => {
    const init = outfitterActions.get("init");
    const presetOption = init?.cli?.options?.find((option) =>
      option.flags.includes("--preset")
    );

    expect(presetOption).toBeDefined();
    expect(presetOption?.description).toContain("library");
    expect(presetOption?.description).toContain("lib");
    expect(presetOption?.description).toContain("full-stack");
    expect(presetOption?.description).toContain("lib");

    const libraryPresetAction = outfitterActions.get("init.library");
    expect(libraryPresetAction).toBeDefined();

    const fullStackPresetAction = outfitterActions.get("init.full-stack");
    expect(fullStackPresetAction).toBeDefined();
  });

  test("normalizes legacy lib preset alias to library", () => {
    const action = outfitterActions.get("init");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["/tmp/lib-init"],
      flags: { preset: "lib" },
    }) as { preset?: string };

    expect(mapped.preset).toBe("library");
  });

  test("maps scaffold shared force/dryRun flags via presets", () => {
    const action = outfitterActions.get("scaffold");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["cli"],
      flags: {
        force: true,
        "dry-run": true,
      },
    }) as { force: boolean; dryRun: boolean };

    expect(mapped.force).toBe(true);
    expect(mapped.dryRun).toBe(true);
  });

  test("maps add shared force/dryRun flags via presets", () => {
    const action = outfitterActions.get("add");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: ["biome"],
      flags: {
        force: true,
        dryRun: true,
      },
    }) as { force: boolean; dryRun: boolean };

    expect(mapped.force).toBe(true);
    expect(mapped.dryRun).toBe(true);
  });
});
