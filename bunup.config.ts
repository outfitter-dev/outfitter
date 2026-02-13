import type { BunupPlugin } from "bunup";
import { defineWorkspace } from "bunup";

// DTS splitting requires Bun >= 1.3.7 (fix: oven-sh/bun#26089)
// TODO: Remove version check once 1.3.7 is widely adopted
const bunVersion = Bun.version.split(".").map(Number);
const supportsDtsSplitting =
  bunVersion[0] > 1 ||
  (bunVersion[0] === 1 && bunVersion[1] > 3) ||
  (bunVersion[0] === 1 && bunVersion[1] === 3 && bunVersion[2] >= 7);

/**
 * Work around Bun duplicate export bug with re-exported entrypoints.
 * Removes duplicate export statements that appear consecutively.
 */
const stripDuplicateExports = (): BunupPlugin => ({
  name: "strip-duplicate-exports",
  hooks: {
    onBuildDone: async ({ files }) => {
      const exportRegex = /export\s*\{\s*([^}]+)\s*\};/g;

      for (const file of files) {
        if (file.dts) continue;
        if (!file.fullPath.endsWith(".js")) continue;

        const content = await Bun.file(file.fullPath).text();
        const matches = [...content.matchAll(exportRegex)];
        if (matches.length < 2) continue;

        const exports = matches.map((match) => {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          const specifiers = match[1]
            .split(",")
            .map((specifier) => specifier.trim())
            .filter(Boolean)
            .sort()
            .join(",");
          return { start, end, specifiers };
        });

        const removals: Array<{ start: number; end: number }> = [];
        for (let i = 0; i < exports.length - 1; i += 1) {
          const current = exports[i];
          const next = exports[i + 1];
          const between = content.slice(current.end, next.start);

          if (between.trim() === "" && current.specifiers === next.specifiers) {
            removals.push({ start: current.end, end: next.end });
            i += 1;
          }
        }

        if (removals.length === 0) continue;

        let nextContent = content;
        for (let i = removals.length - 1; i >= 0; i -= 1) {
          const { start, end } = removals[i];
          nextContent = `${nextContent.slice(0, start)}${nextContent.slice(end)}`;
        }

        if (nextContent !== content) {
          await Bun.write(file.fullPath, nextContent);
        }
      }
    },
  },
});

/**
 * Bunup workspace configuration for tree-shakeable library builds.
 *
 * All library packages use shared options:
 * - ESM format (Bun-native consumers)
 * - Code splitting for optimal chunking
 * - DTS with splitting for type declarations
 * - Auto-generated package.json exports
 * - Bun as target runtime
 *
 * @see https://bunup.dev/docs/guide/workspaces
 */
export default defineWorkspace(
  [
    {
      name: "@outfitter/types",
      root: "packages/types",
      // Prevent future internal utilities from leaking into the public API.
      // All current source files are intentional exports.
      config: {
        exports: {
          exclude: ["./internal", "./internal/*"],
        },
      },
    },
    {
      name: "@outfitter/agents",
      root: "packages/agents",
    },
    {
      name: "@outfitter/contracts",
      root: "packages/contracts",
      // Prevent future internal utilities from leaking into the public API.
      // All current source files (including assert/ and result/) are intentional exports.
      config: {
        exports: {
          exclude: ["./internal", "./internal/*"],
        },
      },
    },
    {
      name: "@outfitter/config",
      root: "packages/config",
    },
    {
      name: "@outfitter/docs-core",
      root: "packages/docs-core",
      // Keep the package surface limited to the library entrypoint.
      // cli-sync is an internal script used by repo tooling.
      config: {
        exports: {
          exclude: ["./cli-sync"],
        },
      },
    },
    {
      name: "@outfitter/docs",
      root: "packages/docs",
      // Publish a stable top-level API from src/index.ts.
      // Internal command modules and the CLI shim are not public imports.
      config: {
        exports: {
          exclude: ["./cli", "./command/*", "./commands/*", "./version"],
        },
      },
    },
    {
      name: "@outfitter/cli",
      root: "packages/cli",
      // Exclude internal exports - consumers should use barrel exports (./render, ./demo)
      config: {
        exports: {
          exclude: [
            "./demo/renderers/*",
            "./demo/registry",
            "./demo/templates",
            "./demo/types",
            "./render/*",
          ],
        },
      },
    },
    {
      name: "@outfitter/index",
      root: "packages/index",
    },
    {
      name: "@outfitter/kit",
      root: "packages/kit",
    },
    {
      name: "@outfitter/tooling",
      root: "packages/tooling",
      // CLI scripts and internal registry modules are not public API.
      // Public surface: ".", "./cli/check", "./cli/fix", "./cli/init", "./registry"
      config: {
        exports: {
          exclude: [
            "./cli/check-clean-tree",
            "./cli/check-exports",
            "./cli/check-readme-imports",
            "./cli/pre-push",
            "./cli/upgrade-bun",
            "./registry/build",
            "./registry/schema",
            "./version",
          ],
          customExports: {
            "./biome.json": "./biome.json",
            "./tsconfig.preset.json": "./tsconfig.preset.json",
            "./tsconfig.preset.bun.json": "./tsconfig.preset.bun.json",
            "./lefthook.yml": "./lefthook.yml",
          },
        },
      },
    },
    {
      name: "outfitter",
      root: "apps/outfitter",
      // Prevent internal utilities from leaking into the public API.
      // Current exports cover all command, engine, and create subpaths.
      config: {
        exports: {
          exclude: ["./internal/*", "./output-mode"],
        },
      },
    },
  ],
  {
    // Entry points: all source files except tests
    entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/__tests__/**"],
    // Source base for correct output structure (strips src/ prefix)
    sourceBase: "./src",
    // Output format: ESM only (Bun ecosystem)
    format: ["esm"],
    // Work around Bun duplicate export bug with re-exported entrypoints
    plugins: [stripDuplicateExports()],
    // TypeScript declarations (splitting enabled when Bun >= 1.3.7)
    dts: supportsDtsSplitting ? { splitting: true } : true,
    // Auto-generate package.json exports field
    exports: true,
    // Code splitting for optimal tree-shaking
    splitting: true,
    // Clean dist before build
    clean: true,
    // Target Bun runtime
    target: "bun",
  }
);
