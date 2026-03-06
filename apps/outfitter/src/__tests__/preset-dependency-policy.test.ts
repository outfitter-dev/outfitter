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

import {
  EXTERNAL_TEMPLATE_VERSION,
  validatePresetDeps,
} from "../commands/check-preset-versions.js";
<<<<<<< HEAD
=======

function stripRangePrefix(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}
>>>>>>> 1bf96636 (test(outfitter): harden preset dependency policy guards)

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
              continue;
            }

            if (
              typeof value !== "string" ||
              name.includes("{{") ||
              value.startsWith("workspace:")
            ) {
              continue;
            }

            const expectedExternal = resolvedVersions[name];
            if (expectedExternal) {
              expect(value).toBe(EXTERNAL_TEMPLATE_VERSION);
              expect(expectedExternal).toMatch(
                /^(\^|~|>=|>|<=|<)?\d+\.\d+\.\d+/
              );
              continue;
            }

            expect.fail(
              `${presetPath}: "${name}" is not declared in the presets catalog`
            );
          }
        }
      }
    }
  });

  test("check-preset-versions validates only the canonical presets root", () => {
    const { all: resolvedVersions } = getResolvedVersions();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-presets-"));
    const canonicalPresetRoot = join(
      workspaceRoot,
      "packages",
      "presets",
      "presets"
    );
    const libraryPresetDir = join(canonicalPresetRoot, "library");
    const legacyRoot = join(workspaceRoot, "templates", "legacy");

    try {
      mkdirSync(libraryPresetDir, { recursive: true });
      writeFileSync(
        join(libraryPresetDir, "package.json.template"),
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

  test("check-preset-versions reports a missing canonical presets root", () => {
    const { all: resolvedVersions } = getResolvedVersions();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-presets-"));

    try {
      const problems: string[] = [];
      validatePresetDeps(workspaceRoot, resolvedVersions, problems);

      expect(problems).toEqual([
        "Canonical presets root not found: packages/presets/presets",
      ]);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("check-preset-versions rejects hardcoded external semver pins in canonical templates", () => {
    const { all: resolvedVersions } = getResolvedVersions();
    const sdkVersion = resolvedVersions["@modelcontextprotocol/sdk"];
    const workspaceRoot = mkdtempSync(join(tmpdir(), "outfitter-presets-"));
    const presetRoot = join(
      workspaceRoot,
      "packages",
      "presets",
      "presets",
      "mcp"
    );

    try {
      expect(
        sdkVersion,
        "@modelcontextprotocol/sdk must be present in the catalog for this test to be meaningful"
      ).toBeDefined();
      if (!sdkVersion) {
        throw new Error(
          "@modelcontextprotocol/sdk must be present in the catalog for this test to be meaningful"
        );
      }

      mkdirSync(presetRoot, { recursive: true });
      writeFileSync(
        join(presetRoot, "package.json.template"),
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/sdk": sdkVersion,
          },
        })
      );

      const problems: string[] = [];
      validatePresetDeps(workspaceRoot, resolvedVersions, problems);

      expect(problems).toContain(
        "packages/presets/presets/mcp/package.json.template: @modelcontextprotocol/sdk must use catalog: (found " +
          sdkVersion +
          ")"
      );
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
