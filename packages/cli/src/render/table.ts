/**
 * Table rendering utilities.
 *
 * Renders arrays of objects as ASCII tables with borders.
 *
 * @packageDocumentation
 */

import { getStringWidth, padText, truncateText } from "./text.js";

/**
 * Configuration options for {@link renderTable}.
 *
 * @example
 * ```typescript
 * const options: TableOptions = {
 *   headers: { id: "ID", name: "Name" },
 *   columnWidths: { description: 20 },
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
}

/**
 * Renders an array of objects as an ASCII table with borders.
 *
 * Automatically calculates column widths based on content unless
 * overridden in options. Supports custom header labels and
 * truncates cell content that exceeds column width.
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
 * // +----+-------+----------+
 * // | ID | Name  | status   |
 * // +----+-------+----------+
 * // | 1  | Alice | Active   |
 * // | 2  | Bob   | Inactive |
 * // +----+-------+----------+
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

  // Build table
  const lines: string[] = [];

  // Header separator
  const headerSep = `+${keys.map((k) => "-".repeat((columnWidths[k] ?? 0) + 2)).join("+")}+`;

  // Header row
  const headerRow = `|${keys
    .map((k) => {
      const header = getHeader(k);
      const width = columnWidths[k] ?? 0;
      return ` ${padText(header, width)} `;
    })
    .join("|")}|`;

  lines.push(headerSep);
  lines.push(headerRow);
  lines.push(headerSep);

  // Data rows
  for (const row of data) {
    const rowStr = `|${keys
      .map((k) => {
        const value = row[k];
        let strValue =
          value === undefined || value === null ? "" : String(value);
        const width = columnWidths[k] ?? 0;

        // Truncate if needed
        if (getStringWidth(strValue) > width) {
          strValue = truncateText(strValue, width);
        }

        return ` ${padText(strValue, width)} `;
      })
      .join("|")}|`;
    lines.push(rowStr);
  }

  lines.push(headerSep);

  return lines.join("\n");
}
