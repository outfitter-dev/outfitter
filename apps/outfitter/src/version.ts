/**
 * Outfitter CLI version, read from package.json at module load time.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";

/** Outfitter CLI version string. Falls back to `"0.0.0"` if unreadable. */
export const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: unknown };

    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through to default.
  }

  return "0.0.0";
})();
