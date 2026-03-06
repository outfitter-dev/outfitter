import { describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getResolvedVersions } from "@outfitter/presets";

import { validatePresetDeps } from "../commands/check-preset-versions.js";

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function getPresetPackageJsonPaths(rootDir: string): readonly string[] {
  const glob = new Bun.Glob("**/package.json.template");
  return Array.from(glob.scanSync({ cwd: rootDir, absolute: false }))
    .map((relative) => join(rootDir, relative))
    .toSorted();
}

describe("preset dependency policy", () => {
  test("all preset package.json files use workspace protocol for @outfitter deps and presets versions for external deps", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = join(currentDir, "..", "..");
    const repoRoot = join(packageRoot, "..", "..");
    const { all: resolvedVersions } = getResolvedVersions();

    const presetRoots = [
      join(repoRoot, "packages", "presets", "presets"),
    ] as const;

    for (const presetRoot of presetRoots) {
      const packagePresets = getPresetPackageJsonPaths(presetRoot);
      for (const presetPath of packagePresets) {
        const parsed = JSON.parse(readFileSync(presetPath, "utf-8")) as Record<
          string,
          unknown
        >;

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

  test("check-preset-versions validates only the canonical presets root", () => {
    const { all: resolvedVersions } = getResolvedVersions();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-presets-"));
    const canonicalRoot = join(
      workspaceRoot,
      "packages",
      "presets",
      "presets",
      "library"
    );
    const legacyRoot = join(workspaceRoot, "templates", "legacy");

    try {
      mkdirSync(canonicalRoot, { recursive: true });
      writeFileSync(
        join(canonicalRoot, "package.json.template"),
        JSON.stringify({
          dependencies: {
            "@outfitter/contracts": "workspace:*",
          },
        })
      );

      mkdirSync(legacyRoot, { recursive: true });
      writeFileSync(
        join(legacyRoot, "package.json.template"),
        JSON.stringify({
          dependencies: {
            "@outfitter/contracts": "^9.9.9",
            "totally-unknown-package": "1.0.0",
          },
        })
      );

      const problems: string[] = [];
      validatePresetDeps(workspaceRoot, resolvedVersions, problems);

      expect(problems).toEqual([]);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
