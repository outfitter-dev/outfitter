import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";

interface PackageJsonContent {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface UpgradeApplyInput {
  readonly latestVersion: string;
  readonly name: string;
}

/**
 * Determine the version range prefix used for a dependency specifier.
 *
 * Returns the prefix (e.g. "^", "~", ">=") or "" if the version has no prefix.
 * Workspace protocol versions are preserved as-is.
 */
function getVersionPrefix(specifier: string): string {
  if (specifier.startsWith("workspace:")) {
    const inner = specifier.slice("workspace:".length);
    return `workspace:${getVersionPrefix(inner)}`;
  }
  const match = specifier.match(/^([\^~>=<]+)/);
  return match?.[1] ?? "";
}

/**
 * Apply non-breaking updates to package.json and run `bun install`.
 *
 * Reads the package.json, updates version ranges for the specified packages
 * (preserving the existing range prefix), writes it back, and runs install.
 */
export async function applyUpdates(
  cwd: string,
  updates: readonly UpgradeApplyInput[]
): Promise<Result<void, OutfitterError>> {
  const pkgPath = join(cwd, "package.json");

  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf-8");
  } catch {
    return Result.err(
      InternalError.create("Failed to read package.json for apply", { cwd })
    );
  }

  let pkg: PackageJsonContent;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return Result.err(
      InternalError.create("Invalid JSON in package.json", { cwd })
    );
  }

  // Build a lookup for quick access
  const updateMap = new Map<string, string>();
  for (const update of updates) {
    updateMap.set(update.name, update.latestVersion);
  }

  // Update dependencies and devDependencies in-place
  for (const section of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[section];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const newVersion = updateMap.get(name);
      if (newVersion === undefined) continue;

      const currentSpecifier = deps[name];
      if (currentSpecifier === undefined) continue;

      const prefix = getVersionPrefix(currentSpecifier);
      deps[name] = `${prefix}${newVersion}`;
    }
  }

  // Write the updated package.json, preserving 2-space indentation
  try {
    const updated = `${JSON.stringify(pkg, null, 2)}\n`;
    await Bun.write(pkgPath, updated);
  } catch {
    return Result.err(
      InternalError.create("Failed to write updated package.json", { cwd })
    );
  }

  // Run bun install to update the lockfile
  try {
    const proc = Bun.spawn(["bun", "install"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return Result.err(
        InternalError.create("bun install failed", {
          cwd,
          exitCode,
          stderr: stderr.trim(),
        })
      );
    }
  } catch {
    return Result.err(
      InternalError.create("Failed to run bun install", { cwd })
    );
  }

  return Result.ok(undefined);
}
