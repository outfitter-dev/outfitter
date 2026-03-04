/**
 * Box composition utilities.
 *
 * Provides type guards and content conversion helpers
 * for composing nested box layouts.
 *
 * @packageDocumentation
 */

import type { Box, BoxContent } from "./box-types.js";

/**
 * Type guard to check if a value is a Box object.
 */
export function isBox(value: unknown): value is Box {
  return (
    typeof value === "object" &&
    value !== null &&
    "output" in value &&
    "width" in value &&
    "height" in value &&
    typeof (value as Box).output === "string" &&
    typeof (value as Box).width === "number" &&
    typeof (value as Box).height === "number"
  );
}

/**
 * Converts BoxContent to an array of string lines.
 */
export function contentToLines(content: BoxContent | BoxContent[]): string[] {
  if (Array.isArray(content)) {
    const lines: string[] = [];
    for (const item of content) {
      if (isBox(item)) {
        lines.push(...item.output.split("\n"));
      } else if (Array.isArray(item)) {
        lines.push(...item);
      } else {
        lines.push(...item.split("\n"));
      }
    }
    return lines;
  }
  if (isBox(content)) {
    return content.output.split("\n");
  }
  if (typeof content === "string") {
    return content.split("\n");
  }
  return content;
}
