/**
 * @outfitter/mcp - Schema Utilities
 *
 * Utilities for converting Zod schemas to JSON Schema format
 * for MCP protocol compatibility.
 *
 * @packageDocumentation
 */

import type { z } from "zod";

/**
 * JSON Schema representation.
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema | Record<string, never>;
  $ref?: string;
  $schema?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
}

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

// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function getDef(schemaOrDef: any): any {
  if (!schemaOrDef) {
    return undefined;
  }

  if (schemaOrDef._def) {
    return schemaOrDef._def;
  }

  if (schemaOrDef.def) {
    return schemaOrDef.def;
  }

  return schemaOrDef;
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function getDescription(schema: any, def: any): string | undefined {
  if (typeof schema?.description === "string") {
    return schema.description;
  }

  if (typeof def?.description === "string") {
    return def.description;
  }

  return undefined;
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
      jsonSchema = convertArray(def);
      break;

    case "ZodObject":
    case "object":
      jsonSchema = convertObject(def);
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
      // Lazy schemas are tricky - just return empty for now
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

/**
 * Convert Zod string schema with checks.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertString(def: any): JsonSchema {
  const schema: JsonSchema = { type: "string" };

  if (def.checks) {
    for (const check of def.checks) {
      const normalizedCheck = check?._zod?.def ?? check?.def ?? check;

      if (normalizedCheck?.kind) {
        switch (normalizedCheck.kind) {
          case "min":
            schema.minLength = normalizedCheck.value;
            break;
          case "max":
            schema.maxLength = normalizedCheck.value;
            break;
          case "length":
            schema.minLength = normalizedCheck.value;
            schema.maxLength = normalizedCheck.value;
            break;
          case "email":
            schema.pattern = "^[^@]+@[^@]+\\.[^@]+$";
            break;
          case "url":
            schema.pattern = "^https?://";
            break;
          case "uuid":
            schema.pattern =
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
            break;
          case "regex":
            schema.pattern =
              normalizedCheck.regex?.source ??
              normalizedCheck.pattern?.source ??
              (typeof normalizedCheck.pattern === "string"
                ? normalizedCheck.pattern
                : undefined);
            break;
          default:
            break;
        }
        continue;
      }

      if (!normalizedCheck?.check) {
        continue;
      }

      switch (normalizedCheck.check) {
        case "min_length":
          schema.minLength = normalizedCheck.minimum;
          break;
        case "max_length":
          schema.maxLength = normalizedCheck.maximum;
          break;
        case "string_format":
          if (normalizedCheck.pattern) {
            schema.pattern =
              typeof normalizedCheck.pattern === "string"
                ? normalizedCheck.pattern
                : normalizedCheck.pattern.source;
          }

          if (normalizedCheck.format && normalizedCheck.format !== "regex") {
            schema.format = normalizedCheck.format;
          }
          break;
        default:
          break;
      }
    }
  }

  return schema;
}

/**
 * Convert Zod number schema with checks.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertNumber(def: any): JsonSchema {
  const schema: JsonSchema = { type: "number" };

  if (def.checks) {
    for (const check of def.checks) {
      const normalizedCheck = check?._zod?.def ?? check?.def ?? check;

      if (normalizedCheck?.kind) {
        switch (normalizedCheck.kind) {
          case "min":
            schema.minimum = normalizedCheck.value;
            break;
          case "max":
            schema.maximum = normalizedCheck.value;
            break;
          case "int":
            schema.type = "integer";
            break;
          default:
            break;
        }
        continue;
      }

      if (!normalizedCheck?.check) {
        continue;
      }

      switch (normalizedCheck.check) {
        case "greater_than":
          if (normalizedCheck.inclusive) {
            schema.minimum = normalizedCheck.value;
          } else {
            schema.exclusiveMinimum = normalizedCheck.value;
          }
          break;
        case "less_than":
          if (normalizedCheck.inclusive) {
            schema.maximum = normalizedCheck.value;
          } else {
            schema.exclusiveMaximum = normalizedCheck.value;
          }
          break;
        case "number_format":
          if (
            normalizedCheck.format === "int" ||
            normalizedCheck.format === "safeint"
          ) {
            schema.type = "integer";
          }
          break;
        default:
          break;
      }
    }
  }

  return schema;
}

/**
 * Convert Zod array schema.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertArray(def: any): JsonSchema {
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
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function isFieldOptional(fieldDef: any): boolean {
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
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertObject(def: any): JsonSchema {
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
