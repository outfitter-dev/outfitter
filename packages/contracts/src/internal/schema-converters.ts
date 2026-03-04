/**
 * Complex Zod-to-JSON-Schema type converters.
 *
 * Handles object, array, union, intersection, optional, default, nullable,
 * record, tuple, and effects types.
 *
 * @internal
 */

import type { z } from "zod";

import type { JsonSchema } from "./schema-types.js";
import { getDef } from "./schema-types.js";

/**
 * Converter function type for the main dispatch function.
 *
 * This is injected to avoid circular dependencies between the converters
 * and the dispatcher in schema.ts.
 */
export type ZodTypeConverter = (schema: z.ZodType<unknown>) => JsonSchema;

/**
 * Convert Zod array schema.
 */
export function convertArray(
  // eslint-disable-next-line typescript/no-explicit-any -- Zod internals
  def: any,
  convertZodType: ZodTypeConverter
): JsonSchema {
  const element = def.element ?? def.type;
  const schema: JsonSchema = {
    type: "array",
    items: element ? convertZodType(element) : {},
  };

  return schema;
}

/**
 * Check if a Zod field is optional by unwrapping wrapper types.
 *
 * This handles cases where optional fields are wrapped in ZodEffects
 * (refinements, transforms) or ZodPipeline, which would otherwise
 * incorrectly appear as required.
 */
// eslint-disable-next-line typescript/no-explicit-any -- Zod internals
export function isFieldOptional(fieldDef: any): boolean {
  if (!(fieldDef?.typeName || fieldDef?.type)) {
    return false;
  }

  const typeName = fieldDef.typeName ?? fieldDef.type;

  // Direct optional or default types
  if (
    typeName === "ZodOptional" ||
    typeName === "ZodDefault" ||
    typeName === "optional" ||
    typeName === "default"
  ) {
    return true;
  }

  // Unwrap ZodEffects (refinements, transforms) and check inner type
  if (typeName === "ZodEffects") {
    return isFieldOptional(getDef(fieldDef.schema));
  }

  // Unwrap ZodPipeline and check both input/output
  // (pipeline: input -> output, optionality requires both to allow undefined)
  if (typeName === "ZodPipeline" || typeName === "pipe") {
    const inputOptional = isFieldOptional(getDef(fieldDef.in));
    const outputDef = getDef(fieldDef.out);
    const outputType = outputDef?.typeName ?? outputDef?.type;

    if (outputType === "transform") {
      return inputOptional;
    }

    const outputOptional = isFieldOptional(outputDef);
    return inputOptional && outputOptional;
  }

  // Unwrap ZodNullable and check inner type
  if (typeName === "ZodNullable" || typeName === "nullable") {
    return isFieldOptional(getDef(fieldDef.innerType));
  }

  return false;
}

/**
 * Convert Zod object schema.
 */
export function convertObject(
  // eslint-disable-next-line typescript/no-explicit-any -- Zod internals
  def: any,
  convertZodType: ZodTypeConverter
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const shape = typeof def.shape === "function" ? def.shape() : def.shape;

  for (const [key, value] of Object.entries(shape ?? {})) {
    properties[key] = convertZodType(value as z.ZodType<unknown>);

    // Check if the field is required (not optional)
    // Unwrap effects/pipeline types to check the inner type
    const fieldDef = getDef(value);
    if (!isFieldOptional(fieldDef)) {
      required.push(key);
    }
  }

  const schema: JsonSchema = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}
