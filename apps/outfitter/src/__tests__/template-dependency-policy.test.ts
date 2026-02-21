import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getResolvedVersions } from "@outfitter/presets";

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function getTemplatePackageJsonPaths(rootDir: string): readonly string[] {
  const glob = new Bun.Glob("**/package.json.template");
  return Array.from(glob.scanSync({ cwd: rootDir, absolute: false }))
    .map((relative) => join(rootDir, relative))
    .sort();
}

describe("template dependency policy", () => {
  test("all template package.json files use workspace protocol for @outfitter deps and presets versions for external deps", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = join(currentDir, "..", "..");
    const repoRoot = join(packageRoot, "..", "..");
    const { all: resolvedVersions } = getResolvedVersions();

    const templateRoots = [
      join(repoRoot, "templates"),
      join(repoRoot, "packages", "presets", "presets"),
    ] as const;

    for (const templateRoot of templateRoots) {
      const packageTemplates = getTemplatePackageJsonPaths(templateRoot);
      for (const templatePath of packageTemplates) {
        const parsed = JSON.parse(
          readFileSync(templatePath, "utf-8")
        ) as Record<string, unknown>;

        for (const section of DEPENDENCY_SECTIONS) {
          const sectionValue = parsed[section];
          if (
            !sectionValue ||
            typeof sectionValue !== "object" ||
            Array.isArray(sectionValue)
          ) {
            continue;
          }

          for (const [name, value] of Object.entries(
            sectionValue as Record<string, unknown>
          )) {
            if (name.startsWith("@outfitter/")) {
              expect(value).toBe("workspace:*");
            }

            const expectedExternal = resolvedVersions[name];
            if (expectedExternal && typeof value === "string") {
              expect(stripRangePrefix(value as string)).toBe(
                stripRangePrefix(expectedExternal)
              );
            }
          }
        }
      }
    }
  });
});
