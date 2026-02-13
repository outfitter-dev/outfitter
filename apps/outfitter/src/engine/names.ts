import { basename } from "node:path";

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
