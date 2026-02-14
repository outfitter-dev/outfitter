export interface CiScriptsOptions {
  checkCommand?: string;
  buildCommand?: string;
  testCommand?: string;
}

export interface PackageJsonLike {
  name?: string;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export interface EnsureCiScriptsResult {
  packageJson: PackageJsonLike;
  changed: boolean;
}

export function ensureCiScripts(
  packageJson: PackageJsonLike,
  options: CiScriptsOptions = {}
): EnsureCiScriptsResult {
  const scripts = { ...(packageJson.scripts ?? {}) };
  const defaults: Record<string, string> = {
    "ci:check": options.checkCommand ?? "bun run check",
    "ci:build": options.buildCommand ?? "bun run build",
    "ci:test": options.testCommand ?? "bun run test",
  };

  let changed = false;

  for (const [scriptName, command] of Object.entries(defaults)) {
    if (!scripts[scriptName]) {
      scripts[scriptName] = command;
      changed = true;
    }
  }

  return {
    packageJson: {
      ...packageJson,
      scripts,
    },
    changed,
  };
}
