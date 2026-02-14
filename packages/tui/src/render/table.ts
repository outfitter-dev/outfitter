/**
 * Table rendering utilities.
 *
 * Renders arrays of objects as tables with Unicode box-drawing borders.
 *
 * @packageDocumentation
 */

import { getStringWidth, padText, truncateText } from "@outfitter/cli/text";
import {
  type BorderCharacters,
  type BorderStyle,
  getBorderCharacters,
} from "./borders.js";

/**
 * Configuration options for {@link renderTable}.
 *
 * @example
 * ```typescript
 * const options: TableOptions = {
 *   headers: { id: "ID", name: "Name" },
 *   columnWidths: { description: 20 },
 *   border: "rounded",
 * };
 * ```
 */
export interface TableOptions {
  /**
   * Fixed column widths by key.
   * If not specified, column width is calculated from content.
   */
  columnWidths?: Record<string, number>;
  /**
   * Custom header labels by key.
   * If not specified, the object key is used as the header.
   */
  headers?: Record<string, string>;
  /**
   * Border style for the table.
   * @default "single"
   */
  border?: BorderStyle;
  /**
   * Compact mode removes all borders and uses space separators.
   * When true, overrides the border option.
   * @default false
   */
  compact?: boolean;
}

/**
 * Renders an array of objects as a table with Unicode box-drawing borders.
 *
 * Automatically calculates column widths based on content unless
 * overridden in options. Supports custom header labels, border styles,
 * and truncates cell content that exceeds column width.
 *
 * @param data - Array of objects to render as rows
 * @param options - Table rendering options
 * @returns Formatted table string with borders
 *
 * @example
 * ```typescript
 * const table = renderTable(
 *   [
 *     { id: 1, name: "Alice", status: "Active" },
 *     { id: 2, name: "Bob", status: "Inactive" },
 *   ],
 *   {
 *     headers: { id: "ID", name: "Name" },
 *     columnWidths: { status: 10 },
 *   }
 * );
 *
 * console.log(table);
 * // ┌────┬───────┬──────────┐
 * // │ ID │ Name  │ status   │
 * // ├────┼───────┼──────────┤
 * // │ 1  │ Alice │ Active   │
 * // │ 2  │ Bob   │ Inactive │
 * // └────┴───────┴──────────┘
 * ```
 */
export function renderTable(
  data: Record<string, unknown>[],
  options?: TableOptions
): string {
  if (data.length === 0) {
    return "";
  }

  // Get all keys from data
  const allKeys = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }
  const keys = Array.from(allKeys);

  // Map headers
  const headers = options?.headers ?? {};
  const getHeader = (key: string): string => headers[key] ?? key;

  // Calculate column widths
  const columnWidths: Record<string, number> = {};
  for (const key of keys) {
    const headerWidth = getStringWidth(getHeader(key));
    let maxDataWidth = 0;

    for (const row of data) {
      const value = row[key];
      const strValue =
        value === undefined || value === null ? "" : String(value);
      const width = getStringWidth(strValue);
      if (width > maxDataWidth) {
        maxDataWidth = width;
      }
    }

    // Use option width if provided, otherwise calculate
    const optionWidth = options?.columnWidths?.[key];
    columnWidths[key] = optionWidth ?? Math.max(headerWidth, maxDataWidth);
  }

  // Determine border style
  const compact = options?.compact ?? false;
  const borderStyle: BorderStyle = compact
    ? "none"
    : (options?.border ?? "single");
  const chars = getBorderCharacters(borderStyle);

  // Check if we have borders
  const hasBorders = borderStyle !== "none";

  // Build table
  return hasBorders
    ? renderWithBorders(data, keys, columnWidths, getHeader, chars)
    : renderCompact(data, keys, columnWidths, getHeader);
}

/**
 * Renders a table with Unicode borders.
 */
function renderWithBorders(
  data: Record<string, unknown>[],
  keys: string[],
  columnWidths: Record<string, number>,
  getHeader: (key: string) => string,
  chars: BorderCharacters
): string {
  const lines: string[] = [];

  // Calculate column widths for border drawing (content width + 2 for padding)
  const colWidthsForBorder = keys.map((k) => (columnWidths[k] ?? 0) + 2);

  // Top border
  lines.push(drawHorizontalBorder(chars, colWidthsForBorder, "top"));

  // Header row
  lines.push(
    drawDataRow(
      keys.map((k) => getHeader(k)),
      keys.map((k) => columnWidths[k] ?? 0),
      chars.vertical
    )
  );

  // Header separator
  lines.push(drawHorizontalBorder(chars, colWidthsForBorder, "middle"));

  // Data rows
  for (const row of data) {
    const values = keys.map((k) => {
      const value = row[k];
      let strValue = value === undefined || value === null ? "" : String(value);
      const width = columnWidths[k] ?? 0;

      // Truncate if needed
      if (getStringWidth(strValue) > width) {
        strValue = truncateText(strValue, width);
      }

      return strValue;
    });

    lines.push(
      drawDataRow(
        values,
        keys.map((k) => columnWidths[k] ?? 0),
        chars.vertical
      )
    );
  }

  // Bottom border
  lines.push(drawHorizontalBorder(chars, colWidthsForBorder, "bottom"));

  return lines.join("\n");
}

/**
 * Renders a compact table without borders.
 */
function renderCompact(
  data: Record<string, unknown>[],
  keys: string[],
  columnWidths: Record<string, number>,
  getHeader: (key: string) => string
): string {
  const lines: string[] = [];

  // Header row
  const headerValues = keys.map((k) => {
    const header = getHeader(k);
    const width = columnWidths[k] ?? 0;
    return padText(header, width);
  });
  lines.push(headerValues.join("  "));

  // Data rows
  for (const row of data) {
    const values = keys.map((k) => {
      const value = row[k];
      let strValue = value === undefined || value === null ? "" : String(value);
      const width = columnWidths[k] ?? 0;

      // Truncate if needed
      if (getStringWidth(strValue) > width) {
        strValue = truncateText(strValue, width);
      }

      return padText(strValue, width);
    });
    lines.push(values.join("  "));
  }

  return lines.join("\n");
}

/**
 * Draws a horizontal border line with intersections.
 */
function drawHorizontalBorder(
  chars: BorderCharacters,
  colWidths: number[],
  position: "top" | "middle" | "bottom"
): string {
  const positionChars = {
    top: { left: chars.topLeft, right: chars.topRight, cross: chars.topT },
    middle: { left: chars.leftT, right: chars.rightT, cross: chars.cross },
    bottom: {
      left: chars.bottomLeft,
      right: chars.bottomRight,
      cross: chars.bottomT,
    },
  } as const;

  const { left, right, cross } = positionChars[position];
  const segments = colWidths.map((w) => chars.horizontal.repeat(w));

  return `${left}${segments.join(cross)}${right}`;
}

/**
 * Draws a data row with vertical separators.
 */
function drawDataRow(
  values: string[],
  widths: number[],
  vertical: string
): string {
  const cells = values.map((value, i) => {
    const width = widths[i] ?? 0;
    return ` ${padText(value, width)} `;
  });

  return `${vertical}${cells.join(vertical)}${vertical}`;
}
