import { basename, isAbsolute, relative } from "node:path";

export function deriveProjectName(packageName: string): string {
  const trimmed = packageName.trim();
  if (!trimmed.startsWith("@")) {
    return trimmed;
  }

  const scopeSeparator = trimmed.indexOf("/");
  if (scopeSeparator < 0) {
    return trimmed;
  }

  return trimmed.slice(scopeSeparator + 1).trim();
}

export function deriveBinName(projectName: string): string {
  return projectName.toLowerCase().replace(/\s+/g, "-");
}

export function resolveAuthor(): string {
  const fromEnv =
    process.env["GIT_AUTHOR_NAME"] ??
    process.env["GIT_COMMITTER_NAME"] ??
    process.env["AUTHOR"] ??
    process.env["USER"] ??
    process.env["USERNAME"];

  if (fromEnv) {
    return fromEnv;
  }

  try {
    const result = Bun.spawnSync(["git", "config", "--get", "user.name"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    if (result.exitCode === 0) {
      const value = result.stdout.toString().trim();
      return value.length > 0 ? value : "";
    }
  } catch {
    // Ignore and fallback
  }

  return "";
}

export function resolveYear(): string {
  return String(new Date().getFullYear());
}

export function resolvePackageName(targetDir: string, name?: string): string {
  return name ?? basename(targetDir);
}

const WINDOWS_ABSOLUTE_PATH_RE = /^[a-zA-Z]:[\\/]/;
const PACKAGE_SEGMENT_RE = /^[a-z0-9._-]+$/;
const RESERVED_PACKAGE_NAMES = new Set(["node_modules", "favicon.ico"]);

/**
 * Validates that a derived project name is safe to use as a single directory segment.
 */
export function validateProjectDirectoryName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "must not be empty";
  }

  if (trimmed === "." || trimmed === "..") {
    return "must not be '.' or '..'";
  }

  if (isAbsolute(trimmed) || WINDOWS_ABSOLUTE_PATH_RE.test(trimmed)) {
    return "must not be an absolute path";
  }

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return "must not contain path separators";
  }

  return undefined;
}

/**
 * Returns true when targetPath resolves inside basePath (or exactly equals it).
 */
export function isPathWithin(basePath: string, targetPath: string): boolean {
  const relativePath = relative(basePath, targetPath);
  if (relativePath === "") {
    return true;
  }

  if (isAbsolute(relativePath)) {
    return false;
  }

  const segments = relativePath.split(/[\\/]/);
  return !segments.includes("..");
}

function sanitizePackageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

/**
 * Returns a best-effort npm-safe package name candidate.
 */
export function sanitizePackageName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("@")) {
    const separator = trimmed.indexOf("/");
    if (separator > 1 && separator < trimmed.length - 1) {
      const scope = sanitizePackageSegment(trimmed.slice(1, separator));
      const pkg = sanitizePackageSegment(trimmed.slice(separator + 1));
      if (scope.length > 0 && pkg.length > 0) {
        return `@${scope}/${pkg}`;
      }
      if (pkg.length > 0) {
        return pkg;
      }
      if (scope.length > 0) {
        return scope;
      }
      return "";
    }
  }

  return sanitizePackageSegment(trimmed);
}

function validatePackageSegment(
  segment: string,
  kind: "scope" | "name"
): string | undefined {
  if (segment.length === 0) {
    return `${kind} must not be empty`;
  }
  if (!PACKAGE_SEGMENT_RE.test(segment)) {
    return `${kind} contains invalid characters`;
  }
  if (kind === "name" && (segment.startsWith(".") || segment.startsWith("_"))) {
    return `${kind} must not start with '.' or '_'`;
  }
  return undefined;
}

/**
 * Validates an npm package name. Returns an error message when invalid.
 */
export function validatePackageName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "must not be empty";
  }
  if (trimmed.length > 214) {
    return "must be 214 characters or fewer";
  }
  if (trimmed !== trimmed.toLowerCase()) {
    return "must be lowercase";
  }
  if (/\s/.test(trimmed)) {
    return "must not contain spaces";
  }

  if (trimmed.startsWith("@")) {
    const separator = trimmed.indexOf("/");
    if (separator <= 1 || separator === trimmed.length - 1) {
      return "scoped names must be in the form @scope/name";
    }
    if (trimmed.indexOf("/", separator + 1) !== -1) {
      return "scoped names must contain exactly one '/' separator";
    }

    const scope = trimmed.slice(1, separator);
    const pkg = trimmed.slice(separator + 1);

    const scopeError = validatePackageSegment(scope, "scope");
    if (scopeError) {
      return scopeError;
    }

    const nameError = validatePackageSegment(pkg, "name");
    if (nameError) {
      return nameError;
    }

    if (RESERVED_PACKAGE_NAMES.has(pkg)) {
      return `'${pkg}' is a reserved package name`;
    }
    return undefined;
  }

  const segmentError = validatePackageSegment(trimmed, "name");
  if (segmentError) {
    return segmentError;
  }
  if (RESERVED_PACKAGE_NAMES.has(trimmed)) {
    return `'${trimmed}' is a reserved package name`;
  }
  return undefined;
}

function sanitizePackageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
}

/**
 * Returns a best-effort npm-safe package name candidate.
 */
export function sanitizePackageName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("@")) {
    const separator = trimmed.indexOf("/");
    if (separator > 1 && separator < trimmed.length - 1) {
      const scope = sanitizePackageSegment(trimmed.slice(1, separator));
      const pkg = sanitizePackageSegment(trimmed.slice(separator + 1));
      if (scope.length > 0 && pkg.length > 0) {
        return `@${scope}/${pkg}`;
      }
      if (pkg.length > 0) {
        return pkg;
      }
      if (scope.length > 0) {
        return scope;
      }
      return "";
    }
  }

  return sanitizePackageSegment(trimmed);
}

function validatePackageSegment(
  segment: string,
  kind: "scope" | "name"
): string | undefined {
  if (segment.length === 0) {
    return `${kind} must not be empty`;
  }
  if (!PACKAGE_SEGMENT_RE.test(segment)) {
    return `${kind} contains invalid characters`;
  }
  if (segment.startsWith(".") || segment.startsWith("_")) {
    return `${kind} must not start with '.' or '_'`;
  }
  return undefined;
}

/**
 * Validates an npm package name. Returns an error message when invalid.
 */
export function validatePackageName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "must not be empty";
  }
  if (trimmed.length > 214) {
    return "must be 214 characters or fewer";
  }
  if (trimmed !== trimmed.toLowerCase()) {
    return "must be lowercase";
  }
  if (/\s/.test(trimmed)) {
    return "must not contain spaces";
  }

  if (trimmed.startsWith("@")) {
    const separator = trimmed.indexOf("/");
    if (separator <= 1 || separator === trimmed.length - 1) {
      return "scoped names must be in the form @scope/name";
    }
    if (trimmed.indexOf("/", separator + 1) !== -1) {
      return "scoped names must contain exactly one '/' separator";
    }

    const scope = trimmed.slice(1, separator);
    const pkg = trimmed.slice(separator + 1);

    const scopeError = validatePackageSegment(scope, "scope");
    if (scopeError) {
      return scopeError;
    }

    const nameError = validatePackageSegment(pkg, "name");
    if (nameError) {
      return nameError;
    }

    if (RESERVED_PACKAGE_NAMES.has(pkg)) {
      return `'${pkg}' is a reserved package name`;
    }
    return undefined;
  }

  const segmentError = validatePackageSegment(trimmed, "name");
  if (segmentError) {
    return segmentError;
  }
  if (RESERVED_PACKAGE_NAMES.has(trimmed)) {
    return `'${trimmed}' is a reserved package name`;
  }
  return undefined;
}
