/**
 * JSON Schema type definitions and Zod introspection helpers.
 *
 * @internal
 */

/**
 * JSON Schema representation.
 */
export interface JsonSchema {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  $schema?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: unknown;
  default?: unknown;
  definitions?: Record<string, JsonSchema>;
  description?: string;
  enum?: unknown[];
  exclusiveMaximum?: number;
  exclusiveMinimum?: number;
  format?: string;
  items?: JsonSchema | JsonSchema[];
  maximum?: number;
  maxLength?: number;
  minimum?: number;
  minLength?: number;
  not?: JsonSchema | Record<string, never>;
  oneOf?: JsonSchema[];
  pattern?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
}

/**
 * Extract the internal _def object from a Zod schema or def.
 */
// eslint-disable-next-line typescript/no-explicit-any -- Zod internals
export function getDef(schemaOrDef: any): any {
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

/**
 * Extract description from a Zod schema or its def.
 */
// eslint-disable-next-line typescript/no-explicit-any -- Zod internals
export function getDescription(schema: any, def: any): string | undefined {
  if (typeof schema?.description === "string") {
    return schema.description;
  }

  if (typeof def?.description === "string") {
    return def.description;
  }

  return undefined;
}
