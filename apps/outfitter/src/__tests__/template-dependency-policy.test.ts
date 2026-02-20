import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import templateVersions from "../../template-versions.json";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

interface TemplateManifest {
  readonly externalDependencies: Record<string, string>;
  readonly internalDependencies: Record<string, string>;
}

function getTemplatePackageJsonPaths(rootDir: string): readonly string[] {
  return readdirSync(rootDir)
    .map((entry) => join(rootDir, entry, "package.json.template"))
    .filter((path) => existsSync(path))
    .sort();
}

describe("template dependency policy", () => {
  test("all template package.json files use workspace protocol for @outfitter deps and manifest versions for external deps", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = join(currentDir, "..", "..");
    const repoRoot = join(packageRoot, "..", "..");
    const manifest = templateVersions as TemplateManifest;

    const templateRoots = [
      join(repoRoot, "templates"),
      join(packageRoot, "templates"),
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

            const expectedExternal = manifest.externalDependencies[name];
            if (expectedExternal) {
              expect(value).toBe(expectedExternal);
            }
          }
        }
      }
    }
  });
});
