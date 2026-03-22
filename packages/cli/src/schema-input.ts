/* eslint-disable outfitter/max-file-lines -- Schema-driven input helpers stay together so flag derivation remains coherent. */
/**
 * Zod-to-Commander flag derivation.
 *
 * Introspects a Zod object schema and derives Commander option definitions
 * for the 80% case: string, number, boolean, enum. Positional args, aliases,
 * and variadic params require explicit declarations.
 *
 * @packageDocumentation
 */

import { ValidationError } from "@outfitter/contracts";
import { Option } from "commander";

/** Result of unwrapping a Zod field's type chain. */
export interface ZodFieldInfo {
  /** The base Zod type name (string, number, boolean, enum). */
  readonly baseType: string;
  /** Default value if .default() was used. */
  readonly defaultValue: unknown;
  /** Description from .describe(). */
  readonly description: string | undefined;
  /** Enum values if baseType is 'enum'. */
  readonly enumValues: readonly string[] | undefined;
  /** Whether .default() was used. */
  readonly hasDefault: boolean;
  /** Whether the field is optional. */
  readonly isOptional: boolean;
}

/** Derived Commander flag definition from a Zod field. */
export interface DerivedFlag {
  /** Commander default value. */
  readonly defaultValue: unknown;
  /** Commander option description. */
  readonly description: string;
  /** Commander flag string (e.g., "--output-dir <value>"). */
  readonly flagString: string;
  /** The base Zod type (string, number, boolean, enum). */
  readonly baseType: string;
  /** Enum values when baseType is "enum". Omitted for non-enum types. */
  readonly enumValues?: readonly string[] | undefined;
  /** Whether this is a boolean flag (no value). */
  readonly isBoolean: boolean;
  /** Whether the field is required (no default, not optional). */
  readonly isRequired: boolean;
  /** Long flag name including dashes (e.g., "--output-dir"). */
  readonly longFlag: string;
  /** Original camelCase field name from the Zod schema. */
  readonly name: string;
}

/**
 * Convert a camelCase string to kebab-case.
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Unwrap a Zod field to extract its base type, description, default, and optionality.
 *
 * Handles chains like: z.string().optional().default('hi').describe('desc')
 */
export function unwrapZodField(field: unknown): ZodFieldInfo {
  let current = field as {
    description?: string;
    options?: readonly string[];
    _zod?: {
      def?: {
        type?: string;
        defaultValue?: unknown;
        innerType?: unknown;
        entries?: Record<string, string>;
      };
    };
  };

  let description = (current as { description?: string }).description;
  let defaultValue: unknown = undefined;
  let hasDefault = false;
  let isOptional = false;

  // Walk through wrapper types (default, optional, nullable)
  // oxlint-disable-next-line no-constant-condition
  while (true) {
    if (description === undefined) {
      description = (current as { description?: string }).description;
    }

    const def = current._zod?.def;
    if (!def?.type) break;

    if (def.type === "default") {
      hasDefault = true;
      defaultValue = def.defaultValue;
      current = def.innerType as typeof current;
      continue;
    }

    if (def.type === "optional" || def.type === "nullable") {
      isOptional = true;
      current = def.innerType as typeof current;
      continue;
    }

    // z.coerce.* wraps in a ZodPipe; walk to the output type
    if (def.type === "pipe") {
      const out = (def as { out?: unknown }).out;
      if (out) {
        current = out as typeof current;
        continue;
      }
      break;
    }

    // Reached the base type
    return {
      baseType: def.type,
      description,
      hasDefault,
      defaultValue,
      isOptional,
      enumValues:
        def.type === "enum"
          ? (current as { options?: readonly string[] }).options
          : undefined,
    };
  }

  return {
    baseType: "unknown",
    description,
    hasDefault,
    defaultValue,
    isOptional,
    enumValues: undefined,
  };
}

/**
 * Derive Commander flag definitions from a Zod object schema.
 *
 * Handles:
 * - z.string() → `--name <value>` (string option)
 * - z.number() → `--count <n>` (number option with coercion)
 * - z.boolean() → `--verbose` (boolean flag)
 * - z.enum(['a','b']) → `--format <value>` with choices
 * - .describe() → option description
 * - .default() → option default
 * - .optional() → not required
 */
export function deriveFlags(
  schema: {
    shape: Record<string, unknown>;
  },
  explicitLongFlags: ReadonlySet<string>
): DerivedFlag[] {
  const flags: DerivedFlag[] = [];

  for (const [fieldName, field] of Object.entries(schema.shape)) {
    const kebabName = camelToKebab(fieldName);
    const longFlag = `--${kebabName}`;

    // Skip if an explicit declaration exists for this flag
    if (explicitLongFlags.has(longFlag)) continue;

    const info = unwrapZodField(field);
    const desc = info.description ?? fieldName;

    let flagString: string;
    let isBoolean = false;
    const isRequired = !info.hasDefault && !info.isOptional;

    switch (info.baseType) {
      case "boolean":
        flagString = longFlag;
        isBoolean = true;
        break;
      case "number":
        flagString = `${longFlag} <n>`;
        break;
      case "string":
      case "enum":
        flagString = `${longFlag} <value>`;
        break;
      case "array":
      case "union":
      case "discriminatedUnion":
      case "tuple":
      case "record":
      case "object":
      case "intersection":
      case "date":
      case "bigint":
      case "literal":
      case "map":
      case "set":
      case "promise":
      case "function":
      case "nan":
      case "void":
      case "undefined":
      case "null":
      case "never":
        // Types that cannot be meaningfully represented as a single CLI flag.
        // Skip to let consumers declare explicit cli.options instead.
        continue;
      default:
        flagString = `${longFlag} <value>`;
        break;
    }

    flags.push({
      name: fieldName,
      longFlag,
      flagString,
      description: desc,
      defaultValue: info.hasDefault ? info.defaultValue : undefined,
      baseType: info.baseType,
      enumValues: info.enumValues,
      isBoolean,
      // Boolean flags are never mandatory — absence semantically means false.
      isRequired: isBoolean ? false : isRequired,
    });
  }

  return flags;
}

/**
 * Create a Commander Option from a derived flag definition,
 * including choices for enum types and argParser for number types.
 */
export function createCommanderOption(
  flag: DerivedFlag,
  _schema: { shape: Record<string, unknown> }
): Option {
  const option = new Option(flag.flagString, flag.description);

  if (flag.defaultValue !== undefined) {
    option.default(flag.defaultValue);
  }

  // For enum fields, set choices
  if (flag.baseType === "enum" && flag.enumValues) {
    option.choices(flag.enumValues as string[]);
  }

  // For number fields, add argParser for coercion
  if (flag.baseType === "number") {
    option.argParser(Number);
  }

  if (flag.isRequired) {
    option.makeOptionMandatory(true);
  }

  return option;
}

/**
 * Extract validated input from parsed Commander flags using a Zod schema.
 *
 * Maps Commander flag values (which use camelCase keys) to the schema
 * field names, then runs Zod validation to apply defaults and coercion.
 */
export function validateInput(
  flags: Record<string, unknown>,
  schema: {
    shape: Record<string, unknown>;
    safeParse: (data: unknown) => {
      success: boolean;
      data?: unknown;
      error?: unknown;
    };
  }
): Record<string, unknown> {
  // Build input object from flags, picking only schema-defined fields
  const input: Record<string, unknown> = {};

  for (const fieldName of Object.keys(schema.shape)) {
    // Commander converts --kebab-case flags to camelCase keys automatically
    // So the flag --output-dir becomes flags.outputDir
    if (fieldName in flags && flags[fieldName] !== undefined) {
      input[fieldName] = flags[fieldName];
    }
  }

  const result = schema.safeParse(input);
  if (result.success) {
    return result.data as Record<string, unknown>;
  }

  // Surface Zod validation errors instead of silently falling through.
  // When .input(schema) is used, invalid data must NEVER reach the handler.
  const rawError = result.error as
    | {
        issues?: ReadonlyArray<{
          path?: ReadonlyArray<string | number>;
          message?: string;
          expected?: string;
          code?: string;
        }>;
      }
    | undefined;

  const rawIssues = rawError?.issues ?? [];
  const issues = rawIssues.map((issue) => ({
    field: (issue.path ?? []).join("."),
    expected: issue.expected,
    message: issue.message ?? "Unknown validation error",
    code: issue.code,
  }));

  const fieldNames = issues.map((i) => i.field).filter(Boolean);
  const summary =
    fieldNames.length > 0
      ? `Invalid input: ${fieldNames.join(", ")}`
      : "Invalid input";

  const detail = issues
    .map((i) => (i.field ? `  ${i.field}: ${i.message}` : `  ${i.message}`))
    .join("\n");

  const message = detail ? `${summary}\n${detail}` : summary;

  // oxlint-disable-next-line outfitter/no-throw-in-handler -- throw: validation failure; Commander action handler catches and formats as error envelope
  throw ValidationError.fromMessage(message, { issues });
}
