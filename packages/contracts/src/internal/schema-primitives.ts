/**
 * Primitive Zod-to-JSON-Schema type converters.
 *
 * Handles string, number, boolean, enum, literal, native enum, and date types.
 *
 * @internal
 */

import type { JsonSchema } from "./schema-types.js";

/**
 * Convert Zod string schema with checks.
 */
// eslint-disable-next-line typescript/no-explicit-any -- Zod internals
export function convertString(def: any): JsonSchema {
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
// eslint-disable-next-line typescript/no-explicit-any -- Zod internals
export function convertNumber(def: any): JsonSchema {
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
