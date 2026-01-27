import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { zodToJsonSchema } from "../schema.js";

describe("zodToJsonSchema required detection", () => {
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

describe("zodToJsonSchema check conversion", () => {
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
