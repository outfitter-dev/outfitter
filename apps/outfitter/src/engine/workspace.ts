import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import { sanitizePackageName } from "./names.js";
import { ScaffoldError } from "./types.js";

function deriveWorkspaceScopeForExamples(workspaceName: string): string {
  const sanitized = sanitizePackageName(workspaceName);
  if (sanitized.startsWith("@")) {
    const separator = sanitized.indexOf("/");
    if (separator > 1) {
      return sanitized.slice(0, separator);
    }
    if (sanitized.length > 1) {
      return sanitized;
    }
  }

  if (sanitized.length > 0) {
    return `@${sanitized}`;
  }

  return "@your-scope";
}

export function buildWorkspaceRootReadme(workspaceName: string): string {
  const workspaceScope = deriveWorkspaceScopeForExamples(workspaceName);

  return `# ${workspaceName}

## Structure

\`\`\`
${workspaceName}/
├── apps/          # Runnable applications (CLI, MCP, daemon, API)
├── packages/      # Shared libraries
└── package.json   # Workspace root
\`\`\`

## Getting Started

\`\`\`bash
# Install all dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Typecheck
bun run typecheck
\`\`\`

## Adding Packages

\`\`\`bash
# Add a new app
outfitter init --name ${workspaceScope}/my-app --preset cli

# Add a shared library
outfitter init --name ${workspaceScope}/my-lib --preset library
\`\`\`
`;
}

export function buildWorkspaceRootPackageJson(workspaceName: string): string {
  const workspacePackage = {
    name: workspaceName,
    private: true,
    version: "0.1.0",
    workspaces: ["apps/*", "packages/*"],
    scripts: {
      build: "bun run --filter '*' build",
      dev: "bun run --filter '*' dev",
      test: "bun run --filter '*' test",
      typecheck: "bun run --filter '*' typecheck",
      lint: "bun run --filter '*' lint",
      "lint:fix": "bun run --filter '*' lint:fix",
      format: "bun run --filter '*' format",
    },
  };

  return `${JSON.stringify(workspacePackage, null, 2)}\n`;
}

export function scaffoldWorkspaceRoot(
  rootDir: string,
  workspaceName: string,
  force: boolean
): Result<void, ScaffoldError> {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath) && !force) {
    return Result.err(
      new ScaffoldError(
        `Directory '${rootDir}' already has a package.json. Use --force to overwrite.`
      )
    );
  }

  try {
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }

    mkdirSync(join(rootDir, "apps"), { recursive: true });
    mkdirSync(join(rootDir, "packages"), { recursive: true });

    writeFileSync(
      packageJsonPath,
      buildWorkspaceRootPackageJson(workspaceName),
      "utf-8"
    );

    const readmePath = join(rootDir, "README.md");
    if (force || !existsSync(readmePath)) {
      writeFileSync(
        readmePath,
        buildWorkspaceRootReadme(workspaceName),
        "utf-8"
      );
    }

    const gitignorePath = join(rootDir, ".gitignore");
    if (force || !existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, "node_modules\n**/dist\n", "utf-8");
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new ScaffoldError(`Failed to scaffold workspace root: ${message}`)
    );
  }
}

/**
 * Extracts workspace glob patterns from a package.json `workspaces` field.
 *
 * Handles both array form (`["apps/*"]`) and object form (`{ packages: ["apps/*"] }`).
 */
export function getWorkspacePatterns(workspaces: unknown): readonly string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter(
      (entry): entry is string => typeof entry === "string"
    );
  }

  if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.filter(
        (entry): entry is string => typeof entry === "string"
      );
    }
  }

  return [];
}

interface PackageDeps {
  workspaces?: unknown;
  [key: string]: unknown;
}

export function hasWorkspacesField(pkg: PackageDeps): boolean {
  const workspaces = pkg.workspaces;

  if (Array.isArray(workspaces) && workspaces.length > 0) {
    return true;
  }

  if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages) && packages.length > 0) {
      return true;
    }
  }

  return false;
}

export function detectWorkspaceRoot(
  cwd: string
): Result<string | null, ScaffoldError> {
  let current = resolve(cwd);
  const root = resolve("/");

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return Result.ok(current);
    }

    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(raw) as PackageDeps;

        if (hasWorkspacesField(pkg)) {
          return Result.ok(current);
        }
      } catch {
        // Ignore and continue walking upward.
      }
    }

    if (current === root) {
      break;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return Result.ok(null);
}
