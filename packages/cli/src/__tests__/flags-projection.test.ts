import { describe, expect, it } from "bun:test";

import {
  composePresets,
  paginationPreset,
  projectionPreset,
  verbosePreset,
} from "../flags.js";

describe("projectionPreset", () => {
  describe("defaults", () => {
    it("has id 'projection'", () => {
      const preset = projectionPreset();
      expect(preset.id).toBe("projection");
    });

    it("defines three options", () => {
      const preset = projectionPreset();
      expect(preset.options).toHaveLength(3);
      expect(preset.options.map((o) => o.flags)).toEqual([
        "--fields <fields>",
        "--exclude-fields <fields>",
        "--count",
      ]);
    });

    it("resolves with undefined fields and false count by default", () => {
      const preset = projectionPreset();
      const result = preset.resolve({});
      expect(result).toEqual({
        fields: undefined,
        excludeFields: undefined,
        count: false,
      });
    });

    it("returns fresh instance per call", () => {
      expect(projectionPreset()).not.toBe(projectionPreset());
    });
  });

  describe("fields resolution", () => {
    it("parses comma-separated fields", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ fields: "name,email,id" }).fields).toEqual([
        "name",
        "email",
        "id",
      ]);
    });

    it("trims whitespace from field names", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ fields: " name , email , id " }).fields).toEqual([
        "name",
        "email",
        "id",
      ]);
    });

    it("returns undefined when not provided", () => {
      const preset = projectionPreset();
      expect(preset.resolve({}).fields).toBeUndefined();
    });

    it("handles single field", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ fields: "name" }).fields).toEqual(["name"]);
    });

    it("filters out empty entries from trailing commas", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ fields: "name,,email," }).fields).toEqual([
        "name",
        "email",
      ]);
    });
  });

  describe("excludeFields resolution", () => {
    it("parses comma-separated exclude fields", () => {
      const preset = projectionPreset();
      expect(
        preset.resolve({ excludeFields: "password,secret" }).excludeFields
      ).toEqual(["password", "secret"]);
    });

    it("handles kebab-case key", () => {
      const preset = projectionPreset();
      expect(
        preset.resolve({ "exclude-fields": "password" }).excludeFields
      ).toEqual(["password"]);
    });

    it("trims whitespace", () => {
      const preset = projectionPreset();
      expect(
        preset.resolve({ excludeFields: " password , secret " }).excludeFields
      ).toEqual(["password", "secret"]);
    });

    it("returns undefined when not provided", () => {
      const preset = projectionPreset();
      expect(preset.resolve({}).excludeFields).toBeUndefined();
    });
  });

  describe("count resolution", () => {
    it("resolves count as true when passed", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ count: true }).count).toBe(true);
    });

    it("resolves count as false by default", () => {
      const preset = projectionPreset();
      expect(preset.resolve({}).count).toBe(false);
    });

    it("coerces truthy values to boolean", () => {
      const preset = projectionPreset();
      expect(preset.resolve({ count: 1 }).count).toBe(true);
    });
  });

  describe("composition", () => {
    it("composes with pagination and verbose presets", () => {
      const composed = composePresets(
        projectionPreset(),
        paginationPreset(),
        verbosePreset()
      );
      expect(composed.options).toHaveLength(7);
      const result = composed.resolve({
        fields: "name,email",
        limit: "10",
        verbose: true,
      });
      expect(result).toEqual({
        fields: ["name", "email"],
        excludeFields: undefined,
        count: false,
        limit: 10,
        next: false,
        reset: false,
        verbose: true,
      });
    });

    it("deduplicates by id when composed twice", () => {
      const composed = composePresets(projectionPreset(), projectionPreset());
      expect(composed.options).toHaveLength(3);
    });
  });
});
