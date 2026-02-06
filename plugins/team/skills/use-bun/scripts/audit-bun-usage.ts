#!/usr/bin/env bun

/**
 * Audit script that detects Node.js patterns replaceable with Bun.
 *
 * Usage: bun audit-bun-usage.ts [path] [--format=json|md]
 *        path defaults to current directory
 *        format defaults to json
 */

import { dirname, join, relative, resolve } from "node:path";

// =============================================================================
// Types
// =============================================================================

interface Replacement {
  id: string;
  name: string;
  category: string;
  bunApi: string;
  docs: string;
  detectors: {
    packages?: string[];
    imports?: string[];
    files?: string[];
  };
  notes?: string;
}

interface Ignore {
  pattern: string;
  reason: string;
  partialReplacement?: boolean;
  exceptions?: string[];
}

interface Manifest {
  version: string;
  bunVersion: string;
  replacements: Replacement[];
  ignores: Ignore[];
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Finding {
  pattern: string;
  type: "package" | "import" | "config";
  category: string;
  replacement: string;
  docs: string;
  count: number;
  locations: string[];
}

interface IgnoredItem {
  pattern: string;
  reason: string;
  locations: string[];
}

interface AuditResult {
  meta: {
    target: string;
    scannedAt: string;
    manifestVersion: string;
  };
  summary: {
    replaceable: number;
    bunNative: number;
    ignored: number;
  };
  findings: Finding[];
  ignored: IgnoredItem[];
  bunUsage: string[];
}

// =============================================================================
// Utilities
// =============================================================================

async function checkRipgrepAvailable(): Promise<boolean> {
  try {
    await Bun.$`rg --version`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function loadManifest(scriptDir: string): Promise<Manifest> {
  const manifestPath = join(scriptDir, "..", "replacements.json");
  const file = Bun.file(manifestPath);

  if (!(await file.exists())) {
    throw new Error(
      `Manifest not found at ${manifestPath}\n` +
        "Ensure replacements.json exists in the skill root directory."
    );
  }

  return (await file.json()) as Manifest;
}

async function loadPackageJson(
  targetPath: string
): Promise<PackageJson | null> {
  const pkgPath = join(targetPath, "package.json");
  const file = Bun.file(pkgPath);

  if (!(await file.exists())) {
    return null;
  }

  return (await file.json()) as PackageJson;
}

function relativePath(targetPath: string, filePath: string): string {
  const rel = relative(targetPath, filePath);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

// =============================================================================
// Scanners
// =============================================================================

async function scanPackageJson(
  _targetPath: string,
  packageJson: PackageJson,
  manifest: Manifest
): Promise<{ findings: Finding[]; ignored: IgnoredItem[] }> {
  const findingsMap = new Map<string, Finding>();
  const ignoredMap = new Map<string, IgnoredItem>();

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const replacement of manifest.replacements) {
    for (const pkg of replacement.detectors.packages ?? []) {
      if (pkg in allDeps) {
        // Check if this should be ignored
        const ignoreEntry = manifest.ignores.find(
          (i) => i.pattern === pkg || pkg.startsWith(i.pattern.replace("*", ""))
        );

        if (ignoreEntry && !ignoreEntry.exceptions?.includes(pkg)) {
          const existing = ignoredMap.get(pkg);
          if (existing) {
            existing.locations.push("package.json");
          } else {
            ignoredMap.set(pkg, {
              pattern: pkg,
              reason: ignoreEntry.reason,
              locations: ["package.json"],
            });
          }
        } else {
          const existing = findingsMap.get(pkg);
          if (existing) {
            existing.count++;
            existing.locations.push("package.json");
          } else {
            findingsMap.set(pkg, {
              pattern: pkg,
              type: "package",
              category: replacement.category,
              replacement: replacement.bunApi,
              docs: replacement.docs,
              count: 1,
              locations: ["package.json"],
            });
          }
        }
      }
    }
  }

  return {
    findings: Array.from(findingsMap.values()),
    ignored: Array.from(ignoredMap.values()),
  };
}

async function scanImports(
  targetPath: string,
  manifest: Manifest
): Promise<{
  findings: Finding[];
  ignored: IgnoredItem[];
  bunUsage: string[];
}> {
  const findingsMap = new Map<string, Finding>();
  const ignoredMap = new Map<string, IgnoredItem>();
  const bunUsage: string[] = [];

  // Scan for each replacement's import patterns
  for (const replacement of manifest.replacements) {
    for (const pattern of replacement.detectors.imports ?? []) {
      try {
        const searchPattern = pattern.startsWith("node:")
          ? `from ['"]${pattern}['"]`
          : `from ['"]${pattern}[/'"]`;

        const result =
          await Bun.$`rg ${searchPattern} --type ts --type js -l --glob '!node_modules/**' --glob '!.git/**' ${targetPath}`
            .quiet()
            .nothrow();

        if (result.exitCode === 0 && result.stdout.toString().trim()) {
          const files = result.stdout
            .toString()
            .trim()
            .split("\n")
            .filter(Boolean);

          // Check if ignored
          const ignoreEntry = manifest.ignores.find(
            (i) =>
              i.pattern === pattern ||
              pattern.startsWith(i.pattern.replace("*", ""))
          );

          if (ignoreEntry && !ignoreEntry.exceptions?.includes(pattern)) {
            const existing = ignoredMap.get(pattern);
            if (existing) {
              existing.locations.push(
                ...files.map((f) => relativePath(targetPath, f))
              );
              existing.locations = [...new Set(existing.locations)];
            } else {
              ignoredMap.set(pattern, {
                pattern,
                reason: ignoreEntry.reason,
                locations: files.map((f) => relativePath(targetPath, f)),
              });
            }
          } else {
            const existing = findingsMap.get(pattern);
            if (existing) {
              existing.count += files.length;
              existing.locations.push(
                ...files.map((f) => relativePath(targetPath, f))
              );
              existing.locations = [...new Set(existing.locations)];
            } else {
              findingsMap.set(pattern, {
                pattern,
                type: "import",
                category: replacement.category,
                replacement: replacement.bunApi,
                docs: replacement.docs,
                count: files.length,
                locations: files.map((f) => relativePath(targetPath, f)),
              });
            }
          }
        }
      } catch {
        // No matches or error
      }
    }
  }

  // Check for Bun API usage (positive signal)
  try {
    const bunResult =
      await Bun.$`rg "Bun\\.(file|write|serve|build|sql|password|hash|Glob|spawn|sleep)" --type ts --type js -l --glob '!node_modules/**' --glob '!.git/**' ${targetPath}`
        .quiet()
        .nothrow();

    if (bunResult.exitCode === 0 && bunResult.stdout.toString().trim()) {
      bunUsage.push(
        ...bunResult.stdout
          .toString()
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((f) => relativePath(targetPath, f))
      );
    }
  } catch {
    // No matches
  }

  return {
    findings: Array.from(findingsMap.values()),
    ignored: Array.from(ignoredMap.values()),
    bunUsage: [...new Set(bunUsage)],
  };
}

async function scanConfigFiles(
  targetPath: string,
  manifest: Manifest
): Promise<{ findings: Finding[]; ignored: IgnoredItem[] }> {
  const findingsMap = new Map<string, Finding>();
  const ignoredMap = new Map<string, IgnoredItem>();

  for (const replacement of manifest.replacements) {
    for (const filePattern of replacement.detectors.files ?? []) {
      const glob = new Bun.Glob(filePattern);

      const files: string[] = [];
      for await (const file of glob.scan({
        cwd: targetPath,
        absolute: true,
        dot: true,
      })) {
        // Skip node_modules
        if (file.includes("/node_modules/")) continue;
        files.push(file);
      }

      if (files.length === 0) continue;

      // Check if ignored
      const ignoreEntry = manifest.ignores.find((i) =>
        filePattern.includes(i.pattern)
      );

      if (ignoreEntry) {
        const existing = ignoredMap.get(filePattern);
        if (existing) {
          existing.locations.push(
            ...files.map((f) => relativePath(targetPath, f))
          );
        } else {
          ignoredMap.set(filePattern, {
            pattern: filePattern,
            reason: ignoreEntry.reason,
            locations: files.map((f) => relativePath(targetPath, f)),
          });
        }
      } else {
        const existing = findingsMap.get(filePattern);
        if (existing) {
          existing.count += files.length;
          existing.locations.push(
            ...files.map((f) => relativePath(targetPath, f))
          );
        } else {
          findingsMap.set(filePattern, {
            pattern: filePattern,
            type: "config",
            category: replacement.category,
            replacement: replacement.bunApi,
            docs: replacement.docs,
            count: files.length,
            locations: files.map((f) => relativePath(targetPath, f)),
          });
        }
      }
    }
  }

  return {
    findings: Array.from(findingsMap.values()),
    ignored: Array.from(ignoredMap.values()),
  };
}

// =============================================================================
// Formatters
// =============================================================================

function formatJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}

function formatMarkdown(result: AuditResult): string {
  const lines: string[] = [];

  lines.push("# Bun Migration Audit");
  lines.push("");
  lines.push(`**Target:** ${result.meta.target}`);
  lines.push(`**Scanned:** ${result.meta.scannedAt}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **${result.summary.replaceable}** replaceable patterns`);
  lines.push(`- **${result.summary.bunNative}** files already using Bun APIs`);
  lines.push(`- **${result.summary.ignored}** patterns ignored`);
  lines.push("");

  // Findings
  if (result.findings.length > 0) {
    lines.push("## Findings");
    lines.push("");

    // Sort by count descending
    const sorted = [...result.findings].sort((a, b) => b.count - a.count);

    for (const finding of sorted) {
      lines.push(
        `### ${finding.pattern} (${finding.count} instance${finding.count === 1 ? "" : "s"}) → ${finding.replacement}`
      );
      for (const loc of finding.locations) {
        lines.push(`- ${loc}`);
      }
      lines.push("");
    }
  }

  // Ignored
  if (result.ignored.length > 0) {
    lines.push("## Ignored");
    lines.push("");

    for (const item of result.ignored) {
      lines.push(`### ${item.pattern}`);
      lines.push(`*${item.reason}*`);
      for (const loc of item.locations) {
        lines.push(`- ${loc}`);
      }
      lines.push("");
    }
  }

  // Bun usage
  if (result.bunUsage.length > 0) {
    lines.push("## Already Using Bun APIs");
    lines.push("");
    for (const file of result.bunUsage) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  // Clean result
  if (result.findings.length === 0 && result.ignored.length === 0) {
    lines.push("## Result");
    lines.push("");
    lines.push("No replaceable patterns found. Project appears Bun-native.");
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  // Parse CLI args
  const args = process.argv.slice(2);
  let targetPath = ".";
  let format: "json" | "md" = "json";

  for (const arg of args) {
    if (arg.startsWith("--format=")) {
      const fmt = arg.replace("--format=", "");
      if (fmt === "md" || fmt === "markdown") {
        format = "md";
      } else if (fmt === "json") {
        format = "json";
      }
    } else if (!arg.startsWith("-")) {
      targetPath = arg;
    }
  }

  targetPath = resolve(targetPath);

  // Check ripgrep availability
  if (!(await checkRipgrepAvailable())) {
    console.error("Error: ripgrep (rg) is required but not found.");
    console.error("Install: brew install ripgrep (macOS)");
    process.exit(1);
  }

  // Load manifest
  const scriptDir = dirname(Bun.main);
  const manifest = await loadManifest(scriptDir);

  // Initialize result
  const result: AuditResult = {
    meta: {
      target: targetPath,
      scannedAt: new Date().toISOString().split("T")[0],
      manifestVersion: manifest.version,
    },
    summary: {
      replaceable: 0,
      bunNative: 0,
      ignored: 0,
    },
    findings: [],
    ignored: [],
    bunUsage: [],
  };

  // Scan package.json
  const packageJson = await loadPackageJson(targetPath);
  if (packageJson) {
    const { findings, ignored } = await scanPackageJson(
      targetPath,
      packageJson,
      manifest
    );
    result.findings.push(...findings);
    result.ignored.push(...ignored);
  }

  // Scan imports
  const {
    findings: importFindings,
    ignored: importIgnored,
    bunUsage,
  } = await scanImports(targetPath, manifest);
  result.findings.push(...importFindings);
  result.ignored.push(...importIgnored);
  result.bunUsage = bunUsage;

  // Scan config files
  const { findings: configFindings, ignored: configIgnored } =
    await scanConfigFiles(targetPath, manifest);
  result.findings.push(...configFindings);
  result.ignored.push(...configIgnored);

  // Deduplicate
  const seenFindings = new Map<string, Finding>();
  for (const f of result.findings) {
    const existing = seenFindings.get(f.pattern);
    if (existing) {
      existing.count += f.count;
      existing.locations = [
        ...new Set([...existing.locations, ...f.locations]),
      ];
    } else {
      seenFindings.set(f.pattern, { ...f });
    }
  }
  result.findings = Array.from(seenFindings.values());

  const seenIgnored = new Map<string, IgnoredItem>();
  for (const i of result.ignored) {
    const existing = seenIgnored.get(i.pattern);
    if (existing) {
      existing.locations = [
        ...new Set([...existing.locations, ...i.locations]),
      ];
    } else {
      seenIgnored.set(i.pattern, { ...i });
    }
  }
  result.ignored = Array.from(seenIgnored.values());

  // Update summary
  result.summary.replaceable = result.findings.reduce(
    (sum, f) => sum + f.count,
    0
  );
  result.summary.bunNative = result.bunUsage.length;
  result.summary.ignored = result.ignored.length;

  // Output
  const output = format === "md" ? formatMarkdown(result) : formatJson(result);
  console.log(output);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
