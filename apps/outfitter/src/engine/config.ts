import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@outfitter/contracts";
import { SHARED_DEV_DEPS, SHARED_SCRIPTS } from "../commands/shared-deps.js";
import {
  applyResolvedDependencyVersions,
  resolveTemplateDependencyVersions,
} from "./dependency-versions.js";
import { ScaffoldError } from "./types.js";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function getWorkspaceMemberPackageJsonPaths(
  rootDir: string,
  rootPackageJson: Record<string, unknown>
): readonly string[] {
  const patterns = getWorkspacePatterns(rootPackageJson["workspaces"]);
  const packageJsonPaths = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const baseDir = join(rootDir, pattern.slice(0, -2));
      if (!existsSync(baseDir)) {
        continue;
      }

      for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const packageJsonPath = join(baseDir, entry.name, "package.json");
        if (existsSync(packageJsonPath)) {
          packageJsonPaths.add(packageJsonPath);
        }
      }
      continue;
    }

    const packageJsonPath = join(rootDir, pattern, "package.json");
    if (existsSync(packageJsonPath)) {
      packageJsonPaths.add(packageJsonPath);
    }
  }

  return [...packageJsonPaths];
}

function rewriteOutfitterDepsToWorkspace(
  packageJson: Record<string, unknown>
): boolean {
  let updated = false;

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = packageJson[section];
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

  return updated;
}

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
    const dependencyVersions = resolveTemplateDependencyVersions();
    applyResolvedDependencyVersions(parsed, dependencyVersions);

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

    const workspaceMembers = getWorkspaceMemberPackageJsonPaths(
      targetDir,
      parsed
    );
    for (const memberPackageJsonPath of workspaceMembers) {
      const memberContent = readFileSync(memberPackageJsonPath, "utf-8");
      const memberParsed = JSON.parse(memberContent) as Record<string, unknown>;
      const before = JSON.stringify(memberParsed);
      applyResolvedDependencyVersions(memberParsed, dependencyVersions);
      if (JSON.stringify(memberParsed) !== before) {
        writeFileSync(
          memberPackageJsonPath,
          `${JSON.stringify(memberParsed, null, 2)}\n`,
          "utf-8"
        );
      }
    }

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
    if (rewriteOutfitterDepsToWorkspace(parsed)) {
      writeFileSync(
        packageJsonPath,
        `${JSON.stringify(parsed, null, 2)}\n`,
        "utf-8"
      );
    }

    const workspaceMembers = getWorkspaceMemberPackageJsonPaths(
      targetDir,
      parsed
    );
    for (const memberPackageJsonPath of workspaceMembers) {
      const memberContent = readFileSync(memberPackageJsonPath, "utf-8");
      const memberParsed = JSON.parse(memberContent) as Record<string, unknown>;
      if (rewriteOutfitterDepsToWorkspace(memberParsed)) {
        writeFileSync(
          memberPackageJsonPath,
          `${JSON.stringify(memberParsed, null, 2)}\n`,
          "utf-8"
        );
      }
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to update local dependencies: ${message}`)
    );
  }
}
