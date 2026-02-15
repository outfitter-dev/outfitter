import { describe, expect, it } from "bun:test";
import { applyVerb, resolveVerb, VERB_FAMILIES } from "../verbs.js";

describe("VERB_FAMILIES", () => {
  it("defines create family", () => {
    expect(VERB_FAMILIES.create).toEqual({
      primary: "create",
      aliases: ["new"],
      description: "Create a new resource",
    });
  });

  it("defines modify family", () => {
    expect(VERB_FAMILIES.modify).toEqual({
      primary: "modify",
      aliases: ["edit", "update"],
      description: "Modify a resource",
    });
  });

  it("defines remove family", () => {
    expect(VERB_FAMILIES.remove).toEqual({
      primary: "remove",
      aliases: ["delete", "rm"],
      description: "Remove a resource",
    });
  });

  it("defines list family", () => {
    expect(VERB_FAMILIES.list).toEqual({
      primary: "list",
      aliases: ["ls"],
      description: "List resources",
    });
  });

  it("defines show family", () => {
    expect(VERB_FAMILIES.show).toEqual({
      primary: "show",
      aliases: ["get", "view"],
      description: "Show details",
    });
  });
});

describe("resolveVerb", () => {
  it("returns default primary and aliases for a family", () => {
    const result = resolveVerb("create");
    expect(result).toEqual({ name: "create", aliases: ["new"] });
  });

  it("overrides primary verb", () => {
    const result = resolveVerb("modify", { primary: "edit" });
    expect(result).toEqual({ name: "edit", aliases: ["update"] });
  });

  it("overrides primary and removes it from aliases", () => {
    const result = resolveVerb("modify", { primary: "update" });
    expect(result).toEqual({ name: "update", aliases: ["edit"] });
  });

  it("disables aliases when aliases: false", () => {
    const result = resolveVerb("remove", { aliases: false });
    expect(result).toEqual({ name: "remove", aliases: [] });
  });

  it("adds extra aliases", () => {
    const result = resolveVerb("create", {
      extraAliases: ["add", "init"],
    });
    expect(result).toEqual({
      name: "create",
      aliases: ["new", "add", "init"],
    });
  });

  it("excludes specific aliases", () => {
    const result = resolveVerb("modify", {
      excludeAliases: ["update"],
    });
    expect(result).toEqual({ name: "modify", aliases: ["edit"] });
  });

  it("combines extra and exclude aliases", () => {
    const result = resolveVerb("modify", {
      extraAliases: ["patch"],
      excludeAliases: ["update"],
    });
    expect(result).toEqual({
      name: "modify",
      aliases: ["edit", "patch"],
    });
  });

  it("throws on unknown family", () => {
    expect(() => resolveVerb("unknown")).toThrow(
      'Unknown verb family: "unknown"'
    );
  });

  it("rejects prototype keys as unknown families", () => {
    expect(() => resolveVerb("__proto__")).toThrow(
      'Unknown verb family: "__proto__"'
    );
    expect(() => resolveVerb("constructor")).toThrow(
      'Unknown verb family: "constructor"'
    );
  });

  it("deduplicates aliases", () => {
    const result = resolveVerb("create", {
      extraAliases: ["new"],
    });
    expect(result).toEqual({ name: "create", aliases: ["new"] });
  });
});

describe("applyVerb", () => {
  it("applies verb name and aliases to a command builder", () => {
    const applied: { aliases: string[] } = { aliases: [] };
    const mockBuilder = {
      alias(a: string) {
        applied.aliases.push(a);
        return this;
      },
    };

    applyVerb(mockBuilder as never, "remove");
    expect(applied.aliases).toEqual(["delete", "rm"]);
  });

  it("respects config overrides", () => {
    const applied: { aliases: string[] } = { aliases: [] };
    const mockBuilder = {
      alias(a: string) {
        applied.aliases.push(a);
        return this;
      },
    };

    applyVerb(mockBuilder as never, "modify", { aliases: false });
    expect(applied.aliases).toEqual([]);
  });
});
