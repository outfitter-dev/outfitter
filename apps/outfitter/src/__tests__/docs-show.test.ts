/**
 * Tests for `docs.show` action — registration, mapInput, and handler.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";

describe("docs.show action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.show");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.show");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
  });

  test("has CLI group 'docs' and command 'show <id>'", () => {
    const action = outfitterActions.get("docs.show");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("show <id>");
  });

  test("mapInput resolves positional id argument", () => {
    const action = outfitterActions.get("docs.show");
    const mapped = action?.cli?.mapInput?.({
      args: ["cli/README.md"],
      flags: {},
    }) as { id: string };

    expect(mapped.id).toBe("cli/README.md");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.show");
    const mapped = action?.cli?.mapInput?.({
      args: ["cli/README.md"],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.show");
    const mapped = action?.cli?.mapInput?.({
      args: ["cli/README.md"],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.show");
    const mapped = action?.cli?.mapInput?.({
      args: ["cli/README.md"],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("mapInput resolves --jq expression", () => {
    const action = outfitterActions.get("docs.show");
    const mapped = action?.cli?.mapInput?.({
      args: ["cli/README.md"],
      flags: { output: "json", jq: ".entry.id" },
    }) as { jq: string | undefined };

    expect(mapped.jq).toBe(".entry.id");
  });
});
