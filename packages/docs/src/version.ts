import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "..");

export const VERSION: string = (() => {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")
    ) as { version?: string };

    if (
      typeof packageJson.version === "string" &&
      packageJson.version.length > 0
    ) {
      return packageJson.version;
    }
  } catch {
    // Fall through.
  }

  return "0.0.0";
})();
