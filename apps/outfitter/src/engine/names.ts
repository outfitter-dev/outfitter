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
  return (
    relativePath === "" ||
    !(relativePath.startsWith("..") || isAbsolute(relativePath))
  );
}
