import { describe, expect, test } from "bun:test";
import {
	type ExportMap,
	extractImports,
	isExportedSubpath,
	parseSpecifier,
} from "../cli/check-readme-imports.js";

// ---------------------------------------------------------------------------
// parseSpecifier
// ---------------------------------------------------------------------------

describe("parseSpecifier", () => {
	test("parses root import with no subpath", () => {
		expect(parseSpecifier("@outfitter/contracts")).toEqual({
			packageName: "@outfitter/contracts",
			subpath: ".",
		});
	});

	test("parses single-level subpath", () => {
		expect(parseSpecifier("@outfitter/cli/output")).toEqual({
			packageName: "@outfitter/cli",
			subpath: "./output",
		});
	});

	test("parses deep subpath", () => {
		expect(parseSpecifier("@outfitter/cli/preset/standard")).toEqual({
			packageName: "@outfitter/cli",
			subpath: "./preset/standard",
		});
	});

	test("returns null for non-scoped packages", () => {
		expect(parseSpecifier("commander")).toBeNull();
	});

	test("returns null for non-@outfitter scoped packages", () => {
		expect(parseSpecifier("@types/node")).toBeNull();
	});

	test("parses @outfitter/mcp/types", () => {
		expect(parseSpecifier("@outfitter/mcp/types")).toEqual({
			packageName: "@outfitter/mcp",
			subpath: "./types",
		});
	});
});

// ---------------------------------------------------------------------------
// extractImports
// ---------------------------------------------------------------------------

describe("extractImports", () => {
	test("extracts imports from typescript code blocks", () => {
		const markdown = [
			"# Example",
			"",
			"```typescript",
			'import { output } from "@outfitter/cli/output";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			packageName: "@outfitter/cli",
			subpath: "./output",
			fullSpecifier: "@outfitter/cli/output",
			file: "README.md",
		});
	});

	test("extracts type imports", () => {
		const markdown = [
			"```ts",
			'import type { OutputMode } from "@outfitter/cli/output";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(1);
		expect(results[0]?.fullSpecifier).toBe("@outfitter/cli/output");
	});

	test("extracts multiple imports from a single code block", () => {
		const markdown = [
			"```typescript",
			'import { output } from "@outfitter/cli/output";',
			'import { collectIds } from "@outfitter/cli/input";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(2);
	});

	test("ignores imports outside code blocks", () => {
		const markdown = [
			'import { output } from "@outfitter/cli/output";',
			"",
			"This is just prose mentioning @outfitter/cli.",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(0);
	});

	test("ignores non-@outfitter imports in code blocks", () => {
		const markdown = [
			"```typescript",
			'import { z } from "zod";',
			'import { Command } from "commander";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(0);
	});

	test("tracks line numbers accurately", () => {
		const markdown = [
			"# Title", // line 1
			"", // line 2
			"Some text.", // line 3
			"", // line 4
			"```typescript", // line 5
			'import { output } from "@outfitter/cli/output";', // line 6
			"```", // line 7
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(1);
		expect(results[0]?.line).toBe(6);
	});

	test("handles js and javascript code blocks", () => {
		const markdown = [
			"```js",
			'import { output } from "@outfitter/cli/output";',
			"```",
			"",
			"```javascript",
			'import { collectIds } from "@outfitter/cli/input";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(2);
	});

	test("deduplicates identical specifiers from the same file", () => {
		const markdown = [
			"```typescript",
			'import { output } from "@outfitter/cli/output";',
			"```",
			"",
			"```typescript",
			'import { output, exitWithError } from "@outfitter/cli/output";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(1);
	});

	test("skips code blocks marked with non-contractual comment", () => {
		const markdown = [
			"<!-- non-contractual -->",
			"```typescript",
			'import { internal } from "@outfitter/cli/internal";',
			"```",
		].join("\n");

		const results = extractImports(markdown, "README.md");
		expect(results).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// isExportedSubpath
// ---------------------------------------------------------------------------

describe("isExportedSubpath", () => {
	const sampleExports: ExportMap = {
		".": {
			import: {
				types: "./dist/index.d.ts",
				default: "./dist/index.js",
			},
		},
		"./output": {
			import: {
				types: "./dist/output.d.ts",
				default: "./dist/output.js",
			},
		},
		"./package.json": "./package.json",
	};

	test("returns true for root subpath when . exists", () => {
		expect(isExportedSubpath(".", sampleExports)).toBe(true);
	});

	test("returns true for existing subpath", () => {
		expect(isExportedSubpath("./output", sampleExports)).toBe(true);
	});

	test("returns false for non-existent subpath", () => {
		expect(isExportedSubpath("./missing", sampleExports)).toBe(false);
	});

	test("returns true for ./package.json", () => {
		expect(isExportedSubpath("./package.json", sampleExports)).toBe(true);
	});

	test("returns false for empty exports", () => {
		expect(isExportedSubpath(".", {})).toBe(false);
	});
});
