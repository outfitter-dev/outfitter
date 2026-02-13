import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@outfitter/contracts";
import { SHARED_DEV_DEPS, SHARED_SCRIPTS } from "../commands/shared-deps.js";
import { ScaffoldError } from "./types.js";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function injectSharedConfig(
  targetDir: string
): Result<void, ScaffoldError> {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return Result.ok(undefined);
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const existingDevDeps =
      (parsed["devDependencies"] as Record<string, unknown>) ?? {};
    parsed["devDependencies"] = { ...SHARED_DEV_DEPS, ...existingDevDeps };

    const existingScripts =
      (parsed["scripts"] as Record<string, unknown>) ?? {};
    parsed["scripts"] = { ...SHARED_SCRIPTS, ...existingScripts };

    writeFileSync(
      packageJsonPath,
      `${JSON.stringify(parsed, null, 2)}\n`,
      "utf-8"
    );
    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to inject shared config: ${message}`)
    );
  }
}

export function rewriteLocalDependencies(
  targetDir: string
): Result<void, ScaffoldError> {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return Result.ok(undefined);
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    let updated = false;

    for (const section of DEPENDENCY_SECTIONS) {
      const deps = parsed[section];
      if (!deps || typeof deps !== "object" || Array.isArray(deps)) {
        continue;
      }

      const entries = deps as Record<string, unknown>;
      for (const [name, version] of Object.entries(entries)) {
        if (
          typeof version === "string" &&
          name.startsWith("@outfitter/") &&
          version !== "workspace:*"
        ) {
          entries[name] = "workspace:*";
          updated = true;
        }
      }
    }

    if (updated) {
      writeFileSync(
        packageJsonPath,
        `${JSON.stringify(parsed, null, 2)}\n`,
        "utf-8"
      );
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to update local dependencies: ${message}`)
    );
  }
}
