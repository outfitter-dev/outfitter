/**
 * @outfitter/tooling - Version
 *
 * Reads the package version from package.json at runtime to avoid
 * hardcoded version strings drifting out of sync.
 *
 * Uses `createRequire` to resolve the package's own `package.json` export,
 * which works regardless of where bundler code splitting places the chunk.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** Fallback version when package.json cannot be read. */
const DEFAULT_VERSION = "0.0.0";

/**
 * Reads the package version from package.json.
 *
 * Resolves the package's own `./package.json` export via `createRequire`,
 * which works correctly in both source (`src/`) and built output (`dist/`)
 * regardless of code-splitting chunk depth.
 */
function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@outfitter/tooling/package.json");
    const packageJson = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version?: unknown;
    };

    if (
      typeof packageJson.version === "string" &&
      packageJson.version.length > 0
    ) {
      return packageJson.version;
    }
  } catch {
    // Fall through to default.
  }

  return DEFAULT_VERSION;
}

/** Package version, read from package.json at load time. */
export const VERSION: string = readPackageVersion();
