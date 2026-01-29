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
 * Remove internal exports from @outfitter/cli package.json.
 * bunup workspace mode doesn't support per-package entry overrides,
 * so we clean up internal exports post-build.
 */
const stripCliInternalExports = (): BunupPlugin => ({
  name: "strip-cli-internal-exports",
  hooks: {
    onBuildDone: async ({ meta }) => {
      if (!meta.rootDir.endsWith("packages/cli")) return;

      const pkgPath = `${meta.rootDir}/package.json`;
      const pkg = await Bun.file(pkgPath).json();

      if (!pkg.exports) return;

      // Internal exports to remove (consumers should use barrel exports)
      const internalPatterns = [
        /^\.\/render\/(?!index)/, // ./render/* except ./render (barrel)
        /^\.\/demo\/renderers\//, // ./demo/renderers/*
        /^\.\/demo\/registry$/, // ./demo/registry
        /^\.\/demo\/templates$/, // ./demo/templates
        /^\.\/demo\/types$/, // ./demo/types
      ];

      const filteredExports: Record<string, unknown> = {};
      let removed = 0;

      for (const [key, value] of Object.entries(pkg.exports)) {
        const isInternal = internalPatterns.some((pattern) =>
          pattern.test(key)
        );
        if (isInternal) {
          removed += 1;
        } else {
          filteredExports[key] = value;
        }
      }

      if (removed > 0) {
        pkg.exports = filteredExports;
        await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      }
    },
  },
});

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
    },
    {
      name: "@outfitter/contracts",
      root: "packages/contracts",
    },
    {
      name: "@outfitter/agents",
      root: "packages/agents",
    },
    {
      name: "@outfitter/cli",
      root: "packages/cli",
      // NOTE: bunup workspace mode doesn't support per-package entry/exports overrides
      // Internal exports (./render/*, ./demo/*) are auto-generated but should be
      // considered unstable. Consumers should use barrel exports: ./render, ./demo
    },
    {
      name: "@outfitter/index",
      root: "packages/index",
    },
    {
      name: "@outfitter/stack",
      root: "packages/stack",
    },
    {
      name: "outfitter",
      root: "apps/outfitter",
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
    // Strip internal exports from @outfitter/cli
    plugins: [stripDuplicateExports(), stripCliInternalExports()],
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
