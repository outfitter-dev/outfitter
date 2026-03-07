/* eslint-disable outfitter/max-file-lines -- Schema conversion helpers share one public surface; splitting would fragment usage. */
/**
 * Schema utilities for Zod-to-JSON-Schema conversion.
 *
 * Provides JSON Schema type definitions, Zod introspection helpers,
 * and a converter that handles common Zod types including strings,
 * numbers, objects, arrays, unions, and more.
 *
 * @module schema
 */

import type { z } from "zod";

import { convertArray, convertObject } from "./internal/schema-converters.js";
import { convertNumber, convertString } from "./internal/schema-primitives.js";
import type { JsonSchema } from "./internal/schema-types.js";
import { getDef, getDescription } from "./internal/schema-types.js";

export type { JsonSchema };

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to JSON Schema format.
 *
 * This is a simplified converter that handles common Zod types.
 * For complex schemas, consider using a full zod-to-json-schema library.
 *
 * @param schema - Zod schema to convert
 * @returns JSON Schema representation
 *
 * @example
 * ```typescript
 * const zodSchema = z.object({
 *   name: z.string(),
 *   age: z.number().optional(),
 * });
 *
 * const jsonSchema = zodToJsonSchema(zodSchema);
 * // {
 * //   type: "object",
 * //   properties: {
 * //     name: { type: "string" },
 * //     age: { type: "number" },
 * //   },
 * //   required: ["name"],
 * // }
 * ```
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): JsonSchema {
  return convertZodType(schema);
}

/**
 * Internal conversion function that handles different Zod types.
 */
function convertZodType(schema: z.ZodType<unknown>): JsonSchema {
  // Access the internal _def property of Zod schemas
  const def = getDef(schema);

  if (!def) {
    return {};
  }

  const typeName = def.typeName ?? def.type;
  let jsonSchema: JsonSchema;

  switch (typeName) {
    case "ZodString":
    case "string":
      jsonSchema = convertString(def);
      break;

    case "ZodNumber":
    case "number":
      jsonSchema = convertNumber(def);
      break;

    case "ZodBoolean":
    case "boolean":
      jsonSchema = { type: "boolean" };
      break;

    case "ZodNull":
    case "null":
      jsonSchema = { type: "null" };
      break;

    case "ZodUndefined":
    case "undefined":
      jsonSchema = {};
      break;

    case "ZodArray":
    case "array":
      jsonSchema = convertArray(def, convertZodType);
      break;

    case "ZodObject":
    case "object":
      jsonSchema = convertObject(def, convertZodType);
      break;

    case "ZodOptional":
    case "optional":
      jsonSchema = convertZodType(def.innerType);
      break;

    case "ZodNullable":
    case "nullable":
      jsonSchema = {
        anyOf: [convertZodType(def.innerType), { type: "null" }],
      };
      break;

    case "ZodDefault":
    case "default": {
      const defaultValue =
        typeof def.defaultValue === "function"
          ? def.defaultValue()
          : def.defaultValue;
      jsonSchema = {
        ...convertZodType(def.innerType),
        default: defaultValue,
      };
      break;
    }

    case "ZodEnum":
    case "enum": {
      const values = def.values ?? Object.values(def.entries ?? {});
      jsonSchema = {
        type: "string",
        enum: values,
      };
      break;
    }

    case "ZodNativeEnum":
      jsonSchema = {
        enum: Object.values(def.values ?? def.entries ?? {}),
      };
      break;

    case "ZodLiteral":
    case "literal": {
      const literalValues = Array.isArray(def.values)
        ? def.values
        : [def.value].filter((value) => value !== undefined);
      if (literalValues.length > 1) {
        jsonSchema = {
          enum: literalValues,
        };
        break;
      }
      jsonSchema = literalValues.length
        ? {
            const: literalValues[0],
          }
        : {};
      break;
    }

    case "ZodUnion":
    case "union":
      jsonSchema = {
        anyOf: def.options.map(convertZodType),
      };
      break;

    case "ZodIntersection":
    case "intersection":
      jsonSchema = {
        allOf: [convertZodType(def.left), convertZodType(def.right)],
      };
      break;

    case "ZodRecord":
    case "record":
      jsonSchema = {
        type: "object",
        additionalProperties: def.valueType
          ? convertZodType(def.valueType)
          : {},
      };
      break;

    case "ZodTuple":
    case "tuple":
      jsonSchema = {
        type: "array",
        items: def.items.map(convertZodType),
      };
      break;

    case "ZodAny":
    case "any":
      jsonSchema = {};
      break;

    case "ZodUnknown":
    case "unknown":
      jsonSchema = {};
      break;

    case "ZodVoid":
    case "void":
      jsonSchema = {};
      break;

    case "ZodNever":
    case "never":
      jsonSchema = { not: {} };
      break;

    case "ZodEffects":
      // Effects (refinements, transforms) don't change the base schema
      jsonSchema = convertZodType(def.schema);
      break;

    case "ZodPipeline":
    case "pipe": {
      const outputDef = getDef(def.out);
      const outputType = outputDef?.typeName ?? outputDef?.type;
      // Use the output type for JSON Schema
      jsonSchema =
        outputType === "transform"
          ? convertZodType(def.in)
          : convertZodType(def.out);
      break;
    }

    case "ZodLazy":
    case "lazy":
      // TODO(OS-xxx): Lazy schemas silently fall back to empty `{}` which
      // produces an unconstrained property in the JSON Schema. Resolve the
      // inner schema at least one level deep, or emit a `$ref`.
      jsonSchema = {};
      break;

    default:
      // Fallback for unknown types
      jsonSchema = {};
      break;
  }

  const description = getDescription(schema, def);
  if (description && !jsonSchema.description) {
    jsonSchema.description = description;
  }

  return jsonSchema;
}
