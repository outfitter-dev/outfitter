import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { buildCliCommands } from "../actions.js";

function createTestRegistry() {
  return createActionRegistry().add(
    defineAction({
      id: "ping",
      description: "Ping action",
      surfaces: ["cli"],
      input: z.object({}),
      cli: { command: "ping" },
      handler: async () => Result.ok({ ok: true }),
    })
  );
}

describe("buildCliCommands schema auto-registration", () => {
  it("includes schema command by default", () => {
    const registry = createTestRegistry();
    const commands = buildCliCommands(registry);
    const names = commands.map((c) => c.name());

    expect(names).toContain("schema");
  });

  it("places schema command after action commands", () => {
    const registry = createTestRegistry();
    const commands = buildCliCommands(registry);
    const names = commands.map((c) => c.name());

    expect(names.indexOf("ping")).toBeLessThan(names.indexOf("schema"));
  });

  it("can opt out with schema: false", () => {
    const registry = createTestRegistry();
    const commands = buildCliCommands(registry, { schema: false });
    const names = commands.map((c) => c.name());

    expect(names).not.toContain("schema");
  });

  it("works with array source", () => {
    const registry = createTestRegistry();
    const commands = buildCliCommands(registry.list());
    const names = commands.map((c) => c.name());

    expect(names).toContain("schema");
  });

  it("accepts schema command options", () => {
    const registry = createTestRegistry();
    const commands = buildCliCommands(registry, {
      schema: { programName: "mycli" },
    });
    const schemaCmd = commands.find((c) => c.name() === "schema");

    expect(schemaCmd).toBeDefined();
  });
});
