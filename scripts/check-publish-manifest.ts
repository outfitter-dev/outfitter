import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version?: string;
}

interface WorkspaceRangeViolation {
  dependency: string;
  range: string;
  section: DependencySection;
}

const CHECKED_SECTIONS: DependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export function findWorkspaceRangeViolations(
  manifest: PackageJson
): WorkspaceRangeViolation[] {
  const violations: WorkspaceRangeViolation[] = [];

  for (const section of CHECKED_SECTIONS) {
    const deps = manifest[section];
    if (!deps) {
      continue;
    }

    for (const [dependency, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        violations.push({ section, dependency, range });
      }
    }
  }

  return violations;
}

function readManifest(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function formatViolations(violations: WorkspaceRangeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `- ${violation.section}: ${violation.dependency} -> ${violation.range}`
    )
    .join("\n");
}

function run(): void {
  const manifestPath = resolve(process.cwd(), "package.json");
  const manifest = readManifest(manifestPath);
  const violations = findWorkspaceRangeViolations(manifest);

  if (violations.length === 0) {
    const packageName = manifest.name ?? manifestPath;
    console.log(
      `[publish-manifest] ${packageName}: no workspace protocol ranges detected`
    );
    return;
  }

  const packageName = manifest.name ?? manifestPath;
  const details = formatViolations(violations);

  console.error(
    [
      `[publish-manifest] ${packageName}: refusing to publish manifest with workspace protocol ranges`,
      details,
      "",
      "Use the release pipeline (`bun run release`) so workspace ranges are rewritten before publish.",
    ].join("\n")
  );

  process.exit(1);
}

if (import.meta.main) {
  run();
}
