import { defineWorkspace } from "bunup";

// DTS splitting requires Bun >= 1.3.7 (fix: oven-sh/bun#26089)
// TODO: Remove version check once 1.3.7 is widely adopted
const bunVersion = Bun.version.split(".").map(Number);
const supportsDtsSplitting =
	bunVersion[0] > 1 ||
	(bunVersion[0] === 1 && bunVersion[1] > 3) ||
	(bunVersion[0] === 1 && bunVersion[1] === 3 && bunVersion[2] >= 7);

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
			name: "@outfitter/cli",
			root: "packages/cli",
		},
		{
			name: "@outfitter/index",
			root: "packages/index",
		},
	],
	{
		// Entry points: all source files except tests
		entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/__tests__/**"],
		// Source base for correct output structure (strips src/ prefix)
		sourceBase: "./src",
		// Output format: ESM only (Bun ecosystem)
		format: ["esm"],
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
	},
);
