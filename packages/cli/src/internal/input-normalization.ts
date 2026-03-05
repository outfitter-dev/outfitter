/**
 * Multi-ID collection for CLI input.
 *
 * `normalizeId` lives in the barrel (`input.ts`) to keep it from becoming
 * a pure re-export file (which breaks bunup shared chunks).
 *
 * @internal
 */

import type { CollectIdsOptions } from "../types.js";
import { readStdin, splitIds } from "./input-helpers.js";
import { isSecurePath } from "./input-security.js";

// =============================================================================
// collectIds()
// =============================================================================

/**
 * Collect IDs from various input formats.
 *
 * Handles space-separated, comma-separated, repeated flags, @file, and stdin.
 *
 * @param input - Raw input from CLI arguments
 * @param options - Collection options
 * @returns Array of collected IDs
 *
 * @example
 * ```typescript
 * // All these produce the same result:
 * // wm show id1 id2 id3
 * // wm show id1,id2,id3
 * // wm show --ids id1 --ids id2
 * // wm show @ids.txt
 * const ids = await collectIds(args.ids, {
 *   allowFile: true,
 *   allowStdin: true,
 * });
 * ```
 */
export async function collectIds(
  input: string | readonly string[],
  options?: CollectIdsOptions
): Promise<string[]> {
  const { allowFile = true, allowStdin = true } = options ?? {};

  const ids: string[] = [];

  // Normalize input to array
  const inputs = Array.isArray(input) ? input : [input];

  for (const item of inputs) {
    if (!item) continue;

    // Check for @file reference
    if (item.startsWith("@")) {
      const filePath = item.slice(1);

      // @- means stdin
      if (filePath === "-") {
        if (!allowStdin) {
          // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: stdin not allowed per options
          throw new Error("Reading from stdin is not allowed");
        }
        const stdinContent = await readStdin();
        const stdinIds = stdinContent
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        ids.push(...stdinIds);
      } else {
        // @file reference
        if (!allowFile) {
          // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: file references not allowed per options
          throw new Error("File references are not allowed");
        }

        // Security: validate path doesn't contain traversal patterns
        if (!isSecurePath(filePath, true)) {
          // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: path traversal security check
          throw new Error(
            `Security error: path traversal not allowed: ${filePath}`
          );
        }

        const file = Bun.file(filePath);
        const exists = await file.exists();
        if (!exists) {
          // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: file must exist
          throw new Error(`File not found: ${filePath}`);
        }
        const content = await file.text();
        const fileIds = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        ids.push(...fileIds);
      }
    } else {
      // Regular input - split by comma and/or space
      ids.push(...splitIds(item));
    }
  }

  // Deduplicate while preserving order
  return [...new Set(ids)];
}
