import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_PREPUBLISH_ONLY =
  "bun ../../scripts/check-publish-manifest.ts";

interface PackageJson {
  name?: string;
  private?: boolean;
  publishConfig?: {
    access?: string;
  };
  scripts?: Record<string, string>;
}

export interface WorkspacePackageManifest {
  path: string;
  manifest: PackageJson;
}

interface PublishGuardrailViolation {
  packageName: string;
  path: string;
  expected: string;
  actual: string | undefined;
}

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const WORKSPACE_DIRS = ["packages", "apps", "plugins"] as const;

function readManifest(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function listWorkspacePackageManifests(): WorkspacePackageManifest[] {
  const manifests: WorkspacePackageManifest[] = [];

  for (const workspaceDirName of WORKSPACE_DIRS) {
    const workspaceDir = join(ROOT, workspaceDirName);
    if (!existsSync(workspaceDir)) {
      continue;
    }

    for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const manifestPath = join(workspaceDir, entry.name, "package.json");
      if (!existsSync(manifestPath)) {
        continue;
      }
      manifests.push({
        path: manifestPath,
        manifest: readManifest(manifestPath),
      });
    }
  }

  return manifests;
}

function isPublishablePackage(manifest: PackageJson): boolean {
  return (
    manifest.private !== true && manifest.publishConfig?.access === "public"
  );
}

export function findPublishGuardrailViolations(
  packages: WorkspacePackageManifest[]
): PublishGuardrailViolation[] {
  const violations: PublishGuardrailViolation[] = [];

  for (const pkg of packages) {
    if (!isPublishablePackage(pkg.manifest)) {
      continue;
    }

    const actual = pkg.manifest.scripts?.prepublishOnly;
    if (actual === REQUIRED_PREPUBLISH_ONLY) {
      continue;
    }

    violations.push({
      packageName: pkg.manifest.name ?? pkg.path,
      path: pkg.path,
      expected: REQUIRED_PREPUBLISH_ONLY,
      actual,
    });
  }

  return violations;
}

function formatActual(actual: string | undefined): string {
  return typeof actual === "string" ? actual : "<missing>";
}

function run(): void {
  const packages = listWorkspacePackageManifests();
  const violations = findPublishGuardrailViolations(packages);

  if (violations.length === 0) {
    console.log(
      `[publish-guardrails] checked ${packages.length} workspace manifests; all publishable packages enforce prepublishOnly guard`
    );
    return;
  }

  const details = violations
    .map(
      (violation) =>
        `- ${violation.packageName} (${violation.path}): prepublishOnly=${formatActual(violation.actual)}; expected=${violation.expected}`
    )
    .join("\n");

  console.error(
    [
      `[publish-guardrails] found ${violations.length} publish guardrail violation(s)`,
      details,
      "",
      "Every public package must set scripts.prepublishOnly to run check-publish-manifest.",
    ].join("\n")
  );
  process.exit(1);
}

if (import.meta.main) {
  run();
}
