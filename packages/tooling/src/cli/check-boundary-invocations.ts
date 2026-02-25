/**
 * Check-boundary-invocations command — validates script commands do not execute
 * package source entrypoints directly from root/app surfaces.
 *
 * @packageDocumentation
 */

import { relative, resolve } from "node:path";

export interface ScriptLocation {
  readonly file: string;
  readonly scriptName: string;
  readonly command: string;
}

export interface BoundaryViolation extends ScriptLocation {
  readonly rule: "root-runs-package-src" | "cd-package-then-runs-src";
}

const ROOT_RUNS_PACKAGE_SRC =
  /\bbun(?:x)?\s+(?:run\s+)?(?:\.\.\/|\.\/)?packages\/[^/\s]+\/src\/\S+/;
const CD_PACKAGE_THEN_RUNS_SRC =
  /\bcd\s+(?:\.\.\/|\.\/)?packages\/[^/\s]+\s*&&\s*bun(?:x)?\s+(?:run\s+)?(?:\.\.\/|\.\/)?src\/\S+/;

interface ReadScriptEntriesOptions {
  readonly appManifestRelativePaths?: readonly string[];
  readonly readPackageJson?: (filePath: string) => Promise<{
    scripts?: Record<string, string>;
  }>;
}

/**
 * Detect whether a single script command violates boundary invocation rules.
 */
export function detectBoundaryViolation(
  location: ScriptLocation
): BoundaryViolation | null {
  if (ROOT_RUNS_PACKAGE_SRC.test(location.command)) {
    return { ...location, rule: "root-runs-package-src" };
  }

  if (CD_PACKAGE_THEN_RUNS_SRC.test(location.command)) {
    return { ...location, rule: "cd-package-then-runs-src" };
  }

  return null;
}

/**
 * Find all boundary violations across package/app script maps.
 */
export function findBoundaryViolations(
  entries: readonly {
    file: string;
    scripts: Readonly<Record<string, string>>;
  }[]
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const entry of entries) {
    for (const [scriptName, command] of Object.entries(entry.scripts)) {
      const violation = detectBoundaryViolation({
        file: entry.file,
        scriptName,
        command,
      });
      if (violation) {
        violations.push(violation);
      }
    }
  }

  return violations.toSorted((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }

    return a.scriptName.localeCompare(b.scriptName);
  });
}

export async function readScriptEntries(
  cwd: string,
  options: ReadScriptEntriesOptions = {}
): Promise<
  {
    file: string;
    scripts: Record<string, string>;
  }[]
> {
  const entries: {
    file: string;
    scripts: Record<string, string>;
  }[] = [];

  const rootPackagePath = resolve(cwd, "package.json");
  const candidatePaths = [rootPackagePath];
  if (options.appManifestRelativePaths) {
    for (const file of options.appManifestRelativePaths) {
      candidatePaths.push(resolve(cwd, file));
    }
  } else {
    const appPackageGlob = new Bun.Glob("apps/*/package.json");
    for (const match of appPackageGlob.scanSync({ cwd })) {
      candidatePaths.push(resolve(cwd, match));
    }
  }

  const readPackageJson =
    options.readPackageJson ??
    (async (filePath: string) =>
      (await Bun.file(filePath).json()) as {
        scripts?: Record<string, string>;
      });

  for (const filePath of candidatePaths) {
    const isRootManifest = filePath === rootPackagePath;
    try {
      const pkg = await readPackageJson(filePath);
      if (!pkg.scripts) {
        continue;
      }

      entries.push({
        file: relative(cwd, filePath),
        scripts: pkg.scripts,
      });
    } catch (error) {
      if (isRootManifest) {
        const message =
          error instanceof Error ? error.message : "unknown parse error";
        throw new Error(
          `Failed to read root package manifest (${filePath}): ${message}`
        );
      }

      // Ignore unreadable non-root package manifests.
    }
  }

  return entries;
}

/**
 * Run boundary invocation checks against root/apps package scripts.
 */
export async function runCheckBoundaryInvocations(): Promise<void> {
  const cwd = process.cwd();
  let entries: {
    file: string;
    scripts: Record<string, string>;
  }[];
  try {
    entries = await readScriptEntries(cwd);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown read failure";
    process.stderr.write(
      `Boundary invocation check failed before evaluation: ${message}\n`
    );
    process.exit(1);
  }
  const violations = findBoundaryViolations(entries);

  if (violations.length === 0) {
    process.stdout.write(
      "No boundary invocation violations detected in root/apps scripts.\n"
    );
    process.exit(0);
  }

  process.stderr.write("Boundary invocation violations detected:\n\n");
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.file}#${violation.scriptName}: ${violation.command}\n`
    );
  }

  process.stderr.write(
    "\nUse canonical command surfaces (e.g. `outfitter repo ...` or package bins) instead of executing packages/*/src directly.\n"
  );

  process.exit(1);
}
