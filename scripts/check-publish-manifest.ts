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
  repository?: string | { url?: unknown };
  version?: string;
}

interface WorkspaceRangeViolation {
  dependency: string;
  range: string;
  section: DependencySection;
}

interface RepositoryUrlViolation {
  actual: string;
  expected: string;
}

const CHECKED_SECTIONS: DependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const EXPECTED_REPOSITORY_PATH = "github.com/outfitter-dev/outfitter";
const EXPECTED_REPOSITORY_HINT =
  "https://github.com/outfitter-dev/outfitter(.git) (git+ prefix allowed)";

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
      if (
        typeof range === "string" &&
        (range.startsWith("workspace:") || range === "catalog:")
      ) {
        violations.push({ section, dependency, range });
      }
    }
  }

  return violations;
}

function normalizeRepositoryPath(url: string): string | null {
  let normalized = url.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.startsWith("git+")) {
    normalized = normalized.slice("git+".length);
  }
  if (normalized.startsWith("git@github.com:")) {
    normalized = `https://github.com/${normalized.slice("git@github.com:".length)}`;
  }
  if (normalized.startsWith("ssh://git@github.com/")) {
    normalized = `https://github.com/${normalized.slice("ssh://git@github.com/".length)}`;
  }

  try {
    const parsed = new URL(normalized);
    const path = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\.git$/u, "")
      .toLowerCase();
    return `${parsed.host.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

export function findRepositoryUrlViolation(
  manifest: PackageJson
): RepositoryUrlViolation | null {
  const rawRepository = manifest.repository;
  const repositoryUrl =
    typeof rawRepository === "string"
      ? rawRepository
      : typeof rawRepository?.url === "string"
        ? rawRepository.url
        : null;

  if (!repositoryUrl) {
    return {
      actual: "<missing>",
      expected: EXPECTED_REPOSITORY_HINT,
    };
  }

  const repositoryPath = normalizeRepositoryPath(repositoryUrl);
  if (repositoryPath === EXPECTED_REPOSITORY_PATH) {
    return null;
  }

  return {
    actual: repositoryUrl,
    expected: EXPECTED_REPOSITORY_HINT,
  };
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
  const repositoryViolation = findRepositoryUrlViolation(manifest);

  if (violations.length === 0 && !repositoryViolation) {
    const packageName = manifest.name ?? manifestPath;
    console.log(
      `[publish-manifest] ${packageName}: no workspace protocol ranges detected`
    );
    return;
  }

  const packageName = manifest.name ?? manifestPath;
  const errorLines: string[] = [];
  if (violations.length > 0) {
    errorLines.push(formatViolations(violations));
  }
  if (repositoryViolation) {
    errorLines.push(
      `- repository.url: ${repositoryViolation.actual} (expected ${repositoryViolation.expected})`
    );
  }

  console.error(
    [
      `[publish-manifest] ${packageName}: refusing to publish manifest due to invalid publish metadata`,
      ...errorLines,
      "",
      "Use the release pipeline (`bun run release`) so publish manifests are validated before npm publish.",
    ].join("\n")
  );

  process.exit(1);
}

if (import.meta.main) {
  run();
}
