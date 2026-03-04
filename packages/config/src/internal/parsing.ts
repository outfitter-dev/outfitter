import type { TaggedErrorClass } from "@outfitter/contracts";
import { Result, TaggedError } from "@outfitter/contracts";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

// ============================================================================
// Error Types
// ============================================================================

// eslint-disable-next-line typescript/consistent-type-definitions -- type required for TaggedError constraint
type ParseErrorFields = {
  /** Human-readable error message describing the parse failure */
  message: string;
  /** Name of the file that failed to parse */
  filename: string;
  /** Line number where the error occurred (if available) */
  line?: number;
  /** Column number where the error occurred (if available) */
  column?: number;
};

const ParseErrorBase: TaggedErrorClass<"ParseError", ParseErrorFields> =
  TaggedError("ParseError")<ParseErrorFields>();

/**
 * Error thrown when a configuration file cannot be parsed.
 *
 * Contains details about the parse failure including the filename
 * and optionally the line/column where the error occurred.
 *
 * @example
 * ```typescript
 * const result = parseConfigFile("invalid toml [", "config.toml");
 * if (result.isErr() && result.error._tag === "ParseError") {
 *   console.error(`Parse error in ${result.error.filename}: ${result.error.message}`);
 * }
 * ```
 */
export class ParseError extends ParseErrorBase {
  readonly category = "validation" as const;
}

// eslint-disable-next-line typescript/consistent-type-definitions -- type required for TaggedError constraint
type CircularExtendsErrorFields = {
  /** Human-readable error message */
  message: string;
  /** The config file paths that form the circular reference */
  chain: string[];
};

const CircularExtendsErrorBase: TaggedErrorClass<
  "CircularExtendsError",
  CircularExtendsErrorFields
> = TaggedError("CircularExtendsError")<CircularExtendsErrorFields>();

/**
 * Error thrown when a circular extends reference is detected.
 */
export class CircularExtendsError extends CircularExtendsErrorBase {
  readonly category = "validation" as const;
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Check if a value is a plain object (not array, null, etc.)
 * @internal
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  // Arrays are not plain objects
  if (Array.isArray(value)) {
    return false;
  }
  return true;
}

/**
 * Deep merge two objects with configurable merge semantics.
 *
 * Merge behavior:
 * - Recursively merges nested plain objects
 * - Arrays are replaced (not concatenated)
 * - `null` explicitly replaces the target value
 * - `undefined` is skipped (does not override)
 *
 * @typeParam T - The type of the target object
 * @param target - Base object to merge into (not mutated)
 * @param source - Object with values to merge
 * @returns New object with merged values
 *
 * @example
 * ```typescript
 * const defaults = { server: { port: 3000, host: "localhost" } };
 * const overrides = { server: { port: 8080 } };
 *
 * const merged = deepMerge(defaults, overrides);
 * // { server: { port: 8080, host: "localhost" } }
 * ```
 *
 * @example
 * ```typescript
 * // Arrays replace, not merge
 * const target = { tags: ["a", "b"] };
 * const source = { tags: ["c"] };
 * deepMerge(target, source); // { tags: ["c"] }
 *
 * // undefined is skipped
 * const base = { a: 1, b: 2 };
 * deepMerge(base, { a: undefined, b: 3 }); // { a: 1, b: 3 }
 *
 * // null explicitly replaces
 * deepMerge(base, { a: null }); // { a: null, b: 2 }
 * ```
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  // Create a new object to avoid mutating the original
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = result[key];

    // undefined doesn't override
    if (sourceValue === undefined) {
      continue;
    }

    // null explicitly replaces
    if (sourceValue === null) {
      result[key] = null;
      continue;
    }

    // Arrays replace (not merge)
    if (Array.isArray(sourceValue)) {
      result[key] = sourceValue;
      continue;
    }

    // Recursively merge plain objects
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Partial<Record<string, unknown>>
      );
      continue;
    }

    // Otherwise, source replaces target
    result[key] = sourceValue;
  }

  return result as T;
}

// ============================================================================
// Config File Parsing
// ============================================================================

/**
 * Get the file extension from a filename (lowercase, without dot).
 * @internal
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Parse configuration file content based on filename extension.
 *
 * Supports multiple formats:
 * - `.toml` - Parsed with smol-toml (preferred for config)
 * - `.yaml`, `.yml` - Parsed with yaml (merge key support enabled)
 * - `.json` - Parsed with strict JSON.parse
 * - `.jsonc` - Parsed with json5 compatibility (comments/trailing commas)
 * - `.json5` - Parsed with json5 (comments and trailing commas allowed)
 *
 * @param content - Raw file content to parse
 * @param filename - Filename used to determine format (by extension)
 * @returns Result containing parsed object or ParseError
 *
 * @example
 * ```typescript
 * const toml = `
 * [server]
 * port = 3000
 * host = "localhost"
 * `;
 *
 * const result = parseConfigFile(toml, "config.toml");
 * if (result.isOk()) {
 *   console.log(result.value.server.port); // 3000
 * }
 * ```
 *
 * @example
 * ```typescript
 * // YAML with anchors/aliases
 * const yaml = `
 * defaults: &defaults
 *   timeout: 5000
 * server:
 *   <<: *defaults
 *   port: 3000
 * `;
 *
 * const result = parseConfigFile(yaml, "config.yaml");
 * if (result.isOk()) {
 *   console.log(result.value.server.timeout); // 5000
 * }
 * ```
 */
export function parseConfigFile(
  content: string,
  filename: string
): Result<Record<string, unknown>, InstanceType<typeof ParseError>> {
  const ext = getExtension(filename);

  try {
    switch (ext) {
      case "toml": {
        const parsed = parseToml(content);
        return Result.ok(parsed as Record<string, unknown>);
      }

      case "yaml":
      case "yml": {
        // Enable merge key support for YAML anchors/aliases
        const parsed = parseYaml(content, { merge: true });
        if (parsed === null || typeof parsed !== "object") {
          return Result.ok({});
        }
        return Result.ok(parsed as Record<string, unknown>);
      }

      case "json": {
        // Use strict JSON parsing for .json files
        const parsed = JSON.parse(content);
        return Result.ok(parsed as Record<string, unknown>);
      }

      case "jsonc":
      case "json5": {
        const parsed = Bun.JSON5.parse(content);
        return Result.ok(parsed as Record<string, unknown>);
      }

      default: {
        return Result.err(
          new ParseError({
            message: `Unsupported config file extension: .${ext}`,
            filename,
          })
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parse error";
    return Result.err(
      new ParseError({
        message: `Failed to parse ${filename}: ${message}`,
        filename,
      })
    );
  }
}
