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
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	enum?: unknown[];
	const?: unknown;
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	allOf?: JsonSchema[];
	not?: JsonSchema | Record<string, never>;
	$ref?: string;
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

/**
 * Internal conversion function that handles different Zod types.
 */
function convertZodType(schema: z.ZodType<unknown>): JsonSchema {
	// Access the internal _def property of Zod schemas
	// biome-ignore lint/suspicious/noExplicitAny: Zod internals require any
	const def = (schema as any)._def;

	if (!def) {
		return {};
	}

	const typeName = def.typeName;

	switch (typeName) {
		case "ZodString":
			return convertString(def);

		case "ZodNumber":
			return convertNumber(def);

		case "ZodBoolean":
			return { type: "boolean" };

		case "ZodNull":
			return { type: "null" };

		case "ZodUndefined":
			return {};

		case "ZodArray":
			return convertArray(def);

		case "ZodObject":
			return convertObject(def);

		case "ZodOptional":
			return convertZodType(def.innerType);

		case "ZodNullable":
			return {
				anyOf: [convertZodType(def.innerType), { type: "null" }],
			};

		case "ZodDefault":
			return {
				...convertZodType(def.innerType),
				default: def.defaultValue(),
			};

		case "ZodEnum":
			return {
				type: "string",
				enum: def.values,
			};

		case "ZodNativeEnum":
			return {
				enum: Object.values(def.values),
			};

		case "ZodLiteral":
			return {
				const: def.value,
			};

		case "ZodUnion":
			return {
				anyOf: def.options.map(convertZodType),
			};

		case "ZodIntersection":
			return {
				allOf: [convertZodType(def.left), convertZodType(def.right)],
			};

		case "ZodRecord":
			return {
				type: "object",
				additionalProperties: convertZodType(def.valueType),
			};

		case "ZodTuple":
			return {
				type: "array",
				items: def.items.map(convertZodType),
			};

		case "ZodAny":
			return {};

		case "ZodUnknown":
			return {};

		case "ZodVoid":
			return {};

		case "ZodNever":
			return { not: {} };

		case "ZodEffects":
			// Effects (refinements, transforms) don't change the base schema
			return convertZodType(def.schema);

		case "ZodPipeline":
			// Use the output type for JSON Schema
			return convertZodType(def.out);

		case "ZodLazy":
			// Lazy schemas are tricky - just return empty for now
			return {};

		default:
			// Fallback for unknown types
			return {};
	}
}

/**
 * Convert Zod string schema with checks.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertString(def: any): JsonSchema {
	const schema: JsonSchema = { type: "string" };

	if (def.checks) {
		for (const check of def.checks) {
			switch (check.kind) {
				case "min":
					schema.minLength = check.value;
					break;
				case "max":
					schema.maxLength = check.value;
					break;
				case "length":
					schema.minLength = check.value;
					schema.maxLength = check.value;
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
					schema.pattern = check.regex.source;
					break;
			}
		}
	}

	if (def.description) {
		schema.description = def.description;
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
			switch (check.kind) {
				case "min":
					schema.minimum = check.value;
					break;
				case "max":
					schema.maximum = check.value;
					break;
				case "int":
					schema.type = "integer";
					break;
			}
		}
	}

	if (def.description) {
		schema.description = def.description;
	}

	return schema;
}

/**
 * Convert Zod array schema.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertArray(def: any): JsonSchema {
	const schema: JsonSchema = {
		type: "array",
		items: convertZodType(def.type),
	};

	if (def.description) {
		schema.description = def.description;
	}

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
	if (!fieldDef?.typeName) {
		return false;
	}

	const typeName = fieldDef.typeName;

	// Direct optional or default types
	if (typeName === "ZodOptional" || typeName === "ZodDefault") {
		return true;
	}

	// Unwrap ZodEffects (refinements, transforms) and check inner type
	if (typeName === "ZodEffects") {
		return isFieldOptional(fieldDef.schema?._def);
	}

	// Unwrap ZodPipeline and check the input type
	// (pipeline: input -> output, optionality comes from input)
	if (typeName === "ZodPipeline") {
		return isFieldOptional(fieldDef.in?._def);
	}

	// Unwrap ZodNullable and check inner type
	if (typeName === "ZodNullable") {
		return isFieldOptional(fieldDef.innerType?._def);
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

	const shape = def.shape();

	for (const [key, value] of Object.entries(shape)) {
		properties[key] = convertZodType(value as z.ZodType<unknown>);

		// Check if the field is required (not optional)
		// Unwrap effects/pipeline types to check the inner type
		// biome-ignore lint/suspicious/noExplicitAny: Zod internals
		const fieldDef = (value as any)._def;
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

	if (def.description) {
		schema.description = def.description;
	}

	return schema;
}
