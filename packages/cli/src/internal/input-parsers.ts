/**
 * Pure CLI input parsers: key-value, range, filter, sort.
 *
 * @internal
 */

import { ValidationError } from "@outfitter/contracts";
import { Err, Ok, type Result } from "better-result";

import type {
  FilterExpression,
  KeyValuePair,
  Range,
  SortCriteria,
} from "../types.js";

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

    const filter: FilterExpression = { field, value };
    if (operator) {
      (filter as { operator: typeof operator }).operator = operator;
    }

    filters.push(filter);
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
