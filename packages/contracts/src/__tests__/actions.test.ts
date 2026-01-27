import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createActionRegistry, defineAction } from "../actions.js";
import { Result } from "../index.js";

describe("action registry", () => {
  it("registers and retrieves actions", () => {
    const registry = createActionRegistry();

    registry.add(
      defineAction({
        id: "alpha",
        description: "Alpha action",
        surfaces: ["cli"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    expect(registry.get("alpha")?.id).toBe("alpha");
    expect(registry.list()).toHaveLength(1);
  });

  it("filters actions by surface", () => {
    const registry = createActionRegistry();

    registry.add(
      defineAction({
        id: "cli-only",
        surfaces: ["cli"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    registry.add(
      defineAction({
        id: "mcp-only",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    expect(registry.forSurface("cli").map((action) => action.id)).toEqual([
      "cli-only",
    ]);
    expect(registry.forSurface("mcp").map((action) => action.id)).toEqual([
      "mcp-only",
    ]);
  });

  it("defaults to all surfaces when none are provided", () => {
    const registry = createActionRegistry();

    registry.add(
      defineAction({
        id: "default",
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    expect(registry.forSurface("cli").map((action) => action.id)).toEqual([
      "default",
    ]);
    expect(registry.forSurface("mcp").map((action) => action.id)).toEqual([
      "default",
    ]);
    expect(registry.forSurface("api").map((action) => action.id)).toEqual([
      "default",
    ]);
    expect(registry.forSurface("server").map((action) => action.id)).toEqual([
      "default",
    ]);
  });
});
