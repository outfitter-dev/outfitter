/**
 * CLI input parsers: file expansion, glob, key-value, range, filter, sort.
 *
 * @internal
 */

import path from "node:path";

import { ValidationError } from "@outfitter/contracts";
import { Err, Ok, type Result } from "better-result";

import type {
  ExpandFileOptions,
  FilterExpression,
  KeyValuePair,
  ParseGlobOptions,
  Range,
  SortCriteria,
} from "../types.js";
import { isDirectory, readStdin } from "./input-helpers.js";
import {
  isSecureGlobPattern,
  isSecurePath,
  isWithinWorkspace,
} from "./input-security.js";

// =============================================================================
// expandFileArg()
// =============================================================================

/**
 * Expand @file references to file contents.
 *
 * If the input starts with @, reads the file and returns its contents.
 * Otherwise, returns the input unchanged.
 *
 * @param input - Raw input that may be a @file reference
 * @param options - Expansion options
 * @returns File contents or original input
 *
 * @example
 * ```typescript
 * // wm create @template.md
 * const content = await expandFileArg(args.content);
 * ```
 */
export async function expandFileArg(
  input: string,
  options?: ExpandFileOptions
): Promise<string> {
  const {
    encoding: _encoding = "utf-8",
    maxSize,
    trim = false,
  } = options ?? {};

  // Not a file reference - return as-is
  if (!input.startsWith("@")) {
    return input;
  }

  const filePath = input.slice(1);

  // @- means stdin
  if (filePath === "-") {
    let content = await readStdin();
    if (trim) {
      content = content.trim();
    }
    return content;
  }

  // Security: validate path doesn't contain traversal patterns
  if (!isSecurePath(filePath, true)) {
    // eslint-disable-next-line outfitter/no-throw-in-handler -- assertion: path traversal security check
    throw new Error(`Security error: path traversal not allowed: ${filePath}`);
  }

  // Read file
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    // eslint-disable-next-line outfitter/no-throw-in-handler -- assertion: file must exist
    throw new Error(`File not found: ${filePath}`);
  }

  // Check size limit before reading
  if (maxSize !== undefined) {
    const size = file.size;
    if (size > maxSize) {
      // eslint-disable-next-line outfitter/no-throw-in-handler -- assertion: file size security check
      throw new Error(`File exceeds maximum size of ${maxSize} bytes`);
    }
  }

  // Read file content - Bun.file.text() always uses UTF-8
  let content = await file.text();

  if (trim) {
    content = content.trim();
  }

  return content;
}

// =============================================================================
// parseGlob()
// =============================================================================

/**
 * Parse and expand glob patterns.
 *
 * Uses Bun.Glob with workspace constraints.
 *
 * @param pattern - Glob pattern to expand
 * @param options - Glob options
 * @returns Array of matched file paths
 *
 * @example
 * ```typescript
 * // wm index "src/**\/*.ts"
 * const files = await parseGlob(args.pattern, {
 *   cwd: workspaceRoot,
 *   ignore: ["node_modules/**"],
 * });
 * ```
 */
export async function parseGlob(
  pattern: string,
  options?: ParseGlobOptions
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    ignore = [],
    onlyFiles = false,
    onlyDirectories = false,
    followSymlinks = false,
  } = options ?? {};

  // Security: validate pattern doesn't escape workspace
  if (!isSecureGlobPattern(pattern)) {
    // eslint-disable-next-line outfitter/no-throw-in-handler -- assertion: glob pattern security check
    throw new Error(
      `Security error: glob pattern may escape workspace: ${pattern}`
    );
  }

  // Resolve workspace root for boundary checking
  const resolvedCwd = path.resolve(cwd);

  const glob = new Bun.Glob(pattern);
  const matches: string[] = [];

  // Scan with options
  // Only set onlyFiles when explicitly requested (not as default)
  const scanOptions = {
    cwd,
    followSymlinks,
    onlyFiles: onlyFiles === true,
  };

  for await (const match of glob.scan(scanOptions)) {
    // Resolve absolute path for workspace boundary check
    const fullPath = path.resolve(cwd, match);

    // Security: verify match is within workspace
    if (!isWithinWorkspace(fullPath, resolvedCwd)) {
      continue;
    }

    // Check against ignore patterns
    let shouldIgnore = false;
    for (const ignorePattern of ignore) {
      const ignoreGlob = new Bun.Glob(ignorePattern);
      if (ignoreGlob.match(match)) {
        shouldIgnore = true;
        break;
      }
    }

    if (shouldIgnore) continue;

    // If onlyDirectories, check if it's a directory
    if (onlyDirectories) {
      const isDir = await isDirectory(fullPath);
      if (!isDir) continue;
    }

    matches.push(match);
  }

  return matches;
}

// =============================================================================
// parseKeyValue()
// =============================================================================

/**
 * Parse key=value pairs from CLI input.
 *
 * @param input - Raw input containing key=value pairs
 * @returns Array of parsed key-value pairs
 *
 * @example
 * ```typescript
 * // --set key=value --set key2=value2
 * // --set key=value,key2=value2
 * const pairs = parseKeyValue(args.set);
 * // => [{ key: "key", value: "value" }, { key: "key2", value: "value2" }]
 * ```
 */
export function parseKeyValue(
  input: string | readonly string[]
): Result<KeyValuePair[], InstanceType<typeof ValidationError>> {
  const pairs: KeyValuePair[] = [];

  // Normalize input to array
  const inputs = Array.isArray(input) ? input : [input];

  for (const item of inputs) {
    if (!item) continue;

    // Split by comma for multiple pairs
    const parts = item.split(",");

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Find first equals sign
      const eqIndex = trimmed.indexOf("=");

      if (eqIndex === -1) {
        return new Err(
          new ValidationError({
            message: `Missing '=' in key-value pair: ${trimmed}`,
          })
        );
      }

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1);

      if (!key) {
        return new Err(
          new ValidationError({ message: "Empty key in key-value pair" })
        );
      }

      pairs.push({ key, value });
    }
  }

  return new Ok(pairs);
}

// =============================================================================
// parseRange()
// =============================================================================

/**
 * Parse range inputs (numeric or date).
 *
 * @param input - Range string (e.g., "1-10" or "2024-01-01..2024-12-31")
 * @param type - Type of range to parse
 * @returns Parsed range
 *
 * @example
 * ```typescript
 * parseRange("1-10", "number");
 * // => Result<{ type: "number", min: 1, max: 10 }, ValidationError>
 *
 * parseRange("2024-01-01..2024-12-31", "date");
 * // => Result<{ type: "date", start: Date, end: Date }, ValidationError>
 * ```
 */
export function parseRange(
  input: string,
  type: "number" | "date"
): Result<Range, InstanceType<typeof ValidationError>> {
  const trimmed = input.trim();

  if (type === "date") {
    // Date range uses ".." separator
    const parts = trimmed.split("..");

    if (parts.length === 1) {
      // Single date - start and end are the same
      const dateStr = parts[0];
      if (dateStr === undefined) {
        return new Err(new ValidationError({ message: "Empty date input" }));
      }
      const date = new Date(dateStr.trim());
      if (Number.isNaN(date.getTime())) {
        return new Err(
          new ValidationError({ message: `Invalid date format: ${dateStr}` })
        );
      }
      return new Ok({ type: "date", start: date, end: date });
    }

    if (parts.length === 2) {
      const startStr = parts[0];
      const endStr = parts[1];
      if (startStr === undefined || endStr === undefined) {
        return new Err(
          new ValidationError({ message: "Invalid date range format" })
        );
      }
      const start = new Date(startStr.trim());
      const end = new Date(endStr.trim());

      if (Number.isNaN(start.getTime())) {
        return new Err(
          new ValidationError({ message: `Invalid date format: ${startStr}` })
        );
      }
      if (Number.isNaN(end.getTime())) {
        return new Err(
          new ValidationError({ message: `Invalid date format: ${endStr}` })
        );
      }

      if (start.getTime() > end.getTime()) {
        return new Err(
          new ValidationError({
            message: "Start date must be before or equal to end date",
          })
        );
      }

      return new Ok({ type: "date", start, end });
    }

    return new Err(
      new ValidationError({ message: `Invalid date range format: ${input}` })
    );
  }

  // Numeric range uses "-" separator (but we need to handle negative numbers)
  // Pattern: handle negative numbers like -10--5 (meaning -10 to -5)

  // Try to parse as single number first
  const singleNum = Number(trimmed);
  if (
    !(
      Number.isNaN(singleNum) ||
      trimmed.includes("-", trimmed.startsWith("-") ? 1 : 0)
    )
  ) {
    return new Ok({ type: "number", min: singleNum, max: singleNum });
  }

  // Parse range with potential negative numbers
  // Strategy: find the separator "-" that isn't part of a negative number
  // A "-" is a separator if:
  // - It's not the first character
  // - The character before it is a digit or space

  let separatorIndex = -1;
  for (let i = 1; i < trimmed.length; i++) {
    const char = trimmed[i];
    const prevChar = trimmed[i - 1];
    // If previous char is a digit or space, this is likely the separator
    if (char === "-" && prevChar !== undefined && /[\d\s]/.test(prevChar)) {
      separatorIndex = i;
      break;
    }
  }

  if (separatorIndex === -1) {
    return new Err(
      new ValidationError({ message: `Invalid numeric range format: ${input}` })
    );
  }

  const minStr = trimmed.slice(0, separatorIndex).trim();
  const maxStr = trimmed.slice(separatorIndex + 1).trim();

  const min = Number(minStr);
  const max = Number(maxStr);

  if (Number.isNaN(min)) {
    return new Err(
      new ValidationError({ message: `Invalid number: ${minStr}` })
    );
  }
  if (Number.isNaN(max)) {
    return new Err(
      new ValidationError({ message: `Invalid number: ${maxStr}` })
    );
  }

  if (min > max) {
    return new Err(
      new ValidationError({ message: "Min must be less than or equal to max" })
    );
  }

  return new Ok({ type: "number", min, max });
}

// =============================================================================
// parseFilter()
// =============================================================================

/**
 * Parse filter expressions from CLI input.
 *
 * @param input - Filter string (e.g., "status:active,priority:high")
 * @returns Array of parsed filter expressions
 *
 * @example
 * ```typescript
 * parseFilter("status:active,priority:high");
 * // => Result<[
 * //   { field: "status", value: "active" },
 * //   { field: "priority", value: "high" }
 * // ], ValidationError>
 * ```
 */
export function parseFilter(
  input: string
): Result<FilterExpression[], InstanceType<typeof ValidationError>> {
  const trimmed = input.trim();

  if (!trimmed) {
    return new Ok([]);
  }

  const filters: FilterExpression[] = [];

  // Split by comma for multiple filters
  const parts = trimmed.split(",");

  for (const part of parts) {
    let partTrimmed = part.trim();
    if (!partTrimmed) continue;

    // Check for negation prefix
    let isNegated = false;
    if (partTrimmed.startsWith("!")) {
      isNegated = true;
      partTrimmed = partTrimmed.slice(1).trim();
    }

    // Find first colon (field:value separator)
    const colonIndex = partTrimmed.indexOf(":");

    if (colonIndex === -1) {
      return new Err(
        new ValidationError({
          message: `Missing ':' in filter expression: ${part.trim()}`,
        })
      );
    }

    const field = partTrimmed.slice(0, colonIndex).trim();
    let value = partTrimmed.slice(colonIndex + 1).trim();

    // Check for operators in value
    let operator: FilterExpression["operator"] | undefined;

    if (isNegated) {
      operator = "ne";
    } else if (value.startsWith(">=")) {
      operator = "gte";
      value = value.slice(2).trim();
    } else if (value.startsWith("<=")) {
      operator = "lte";
      value = value.slice(2).trim();
    } else if (value.startsWith(">")) {
      operator = "gt";
      value = value.slice(1).trim();
    } else if (value.startsWith("<")) {
      operator = "lt";
      value = value.slice(1).trim();
    } else if (value.startsWith("~")) {
      operator = "contains";
      value = value.slice(1).trim();
    }

    filters.push(operator ? { field, operator, value } : { field, value });
  }

  return new Ok(filters);
}

// =============================================================================
// parseSortSpec()
// =============================================================================

/**
 * Parse sort specification from CLI input.
 *
 * @param input - Sort string (e.g., "modified:desc,title:asc")
 * @returns Array of parsed sort criteria
 *
 * @example
 * ```typescript
 * parseSortSpec("modified:desc,title:asc");
 * // => Result<[
 * //   { field: "modified", direction: "desc" },
 * //   { field: "title", direction: "asc" }
 * // ], ValidationError>
 * ```
 */
export function parseSortSpec(
  input: string
): Result<SortCriteria[], InstanceType<typeof ValidationError>> {
  const trimmed = input.trim();

  if (!trimmed) {
    return new Ok([]);
  }

  const criteria: SortCriteria[] = [];

  // Split by comma for multiple sort fields
  const parts = trimmed.split(",");

  for (const part of parts) {
    const partTrimmed = part.trim();
    if (!partTrimmed) continue;

    // Check for direction (field:direction)
    const colonIndex = partTrimmed.indexOf(":");

    if (colonIndex === -1) {
      // No direction specified - default to asc
      criteria.push({ field: partTrimmed, direction: "asc" });
    } else {
      const field = partTrimmed.slice(0, colonIndex).trim();
      const direction = partTrimmed
        .slice(colonIndex + 1)
        .trim()
        .toLowerCase();

      if (direction !== "asc" && direction !== "desc") {
        return new Err(
          new ValidationError({
            message: `Invalid sort direction: ${direction}. Must be 'asc' or 'desc'.`,
          })
        );
      }

      criteria.push({ field, direction });
    }
  }

  return new Ok(criteria);
}
