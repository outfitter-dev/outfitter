import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { zodToJsonSchema } from "../schema.js";

describe("zodToJsonSchema", () => {
  describe("basic types", () => {
    it("converts string schema", () => {
      expect(zodToJsonSchema(z.string())).toEqual({ type: "string" });
    });

    it("converts number schema", () => {
      expect(zodToJsonSchema(z.number())).toEqual({ type: "number" });
    });

    it("converts boolean schema", () => {
      expect(zodToJsonSchema(z.boolean())).toEqual({ type: "boolean" });
    });

    it("converts null schema", () => {
      expect(zodToJsonSchema(z.null())).toEqual({ type: "null" });
    });
  });

  describe("object schemas", () => {
    it("converts a simple object", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe("object");
      expect(jsonSchema.properties?.["name"]).toEqual({ type: "string" });
      expect(jsonSchema.properties?.["age"]).toEqual({ type: "number" });
      expect(jsonSchema.required).toEqual(["name"]);
    });
  });

  describe("required detection", () => {
    it("omits required for optional fields wrapped by effects", () => {
      const schema = z.object({
        name: z
          .string()
          .optional()
          .transform((value) => value ?? "anonymous"),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toBeUndefined();
    });

    it("keeps required for pipeline fields unless both sides are optional", () => {
      const schema = z.object({
        id: z.string().optional().pipe(z.string()),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toEqual(["id"]);
    });

    it("marks pipeline optional when both input and output are optional", () => {
      const schema = z.object({
        id: z.string().optional().pipe(z.string().optional()),
      });

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.required).toBeUndefined();
    });
  });

  describe("check conversion", () => {
    it("captures string format metadata", () => {
      const schema = z.string().email();

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.format).toBe("email");
    });

    it("captures numeric exclusivity and integer format", () => {
      const schema = z.number().gt(1).lte(10).int();

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe("integer");
      expect(jsonSchema.exclusiveMinimum).toBe(1);
      expect(jsonSchema.maximum).toBe(10);
    });

    it("uses enum when literal values include multiple entries", () => {
      const schema = {
        _def: {
          type: "literal",
          values: ["north", "waymark"],
        },
      } as unknown as z.ZodType<unknown>;

      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.enum).toEqual(["north", "waymark"]);
      expect(jsonSchema.const).toBeUndefined();
    });
  });

  describe("enum and union", () => {
    it("converts enum schema", () => {
      const schema = z.enum(["a", "b", "c"]);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["a", "b", "c"]);
    });

    it("converts union schema", () => {
      const schema = z.union([z.string(), z.number()]);
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.anyOf).toEqual([
        { type: "string" },
        { type: "number" },
      ]);
    });
  });

  describe("array schemas", () => {
    it("converts array of strings", () => {
      const schema = z.array(z.string());
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe("array");
      expect(jsonSchema.items).toEqual({ type: "string" });
    });
  });

  describe("nullable and default", () => {
    it("converts nullable schema", () => {
      const schema = z.string().nullable();
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.anyOf).toEqual([{ type: "string" }, { type: "null" }]);
    });

    it("converts default schema", () => {
      const schema = z.string().default("hello");
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.default).toBe("hello");
    });
  });

  describe("descriptions", () => {
    it("preserves description on schema", () => {
      const schema = z.string().describe("A name field");
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema.description).toBe("A name field");
    });
  });
});
