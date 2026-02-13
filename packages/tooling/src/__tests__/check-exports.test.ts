import { describe, expect, test } from "bun:test";
import {
	type CheckResult,
	compareExports,
	type ExportMap,
	entryToSubpath,
} from "../cli/check-exports.js";

describe("entryToSubpath", () => {
	test("maps root index.ts to '.'", () => {
		expect(entryToSubpath("src/index.ts")).toBe(".");
	});

	test("maps top-level file to bare name", () => {
		expect(entryToSubpath("src/branded.ts")).toBe("./branded");
	});

	test("maps nested index.ts to directory path", () => {
		expect(entryToSubpath("src/cli/index.ts")).toBe("./cli");
	});

	test("maps nested file to full subpath", () => {
		expect(entryToSubpath("src/cli/check.ts")).toBe("./cli/check");
	});
});

describe("compareExports", () => {
	const simpleEntry = (name: string) => ({
		import: {
			types: `./dist/${name}.d.ts`,
			default: `./dist/${name}.js`,
		},
	});

	test("reports ok when exports match exactly", () => {
		const exports: ExportMap = {
			".": simpleEntry("index"),
			"./branded": simpleEntry("branded"),
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual: exports,
			expected: exports,
		});

		expect(result.status).toBe("ok");
		expect(result.drift).toBeUndefined();
	});

	test("detects added exports (in expected but not actual)", () => {
		const actual: ExportMap = {
			".": simpleEntry("index"),
		};
		const expected: ExportMap = {
			".": simpleEntry("index"),
			"./branded": simpleEntry("branded"),
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual,
			expected,
		});

		expect(result.status).toBe("drift");
		expect(result.drift).toBeDefined();
		expect(result.drift?.added).toEqual(["./branded"]);
		expect(result.drift?.removed).toEqual([]);
		expect(result.drift?.changed).toEqual([]);
	});

	test("detects removed exports (in actual but not expected)", () => {
		const actual: ExportMap = {
			".": simpleEntry("index"),
			"./old-module": simpleEntry("old-module"),
		};
		const expected: ExportMap = {
			".": simpleEntry("index"),
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual,
			expected,
		});

		expect(result.status).toBe("drift");
		expect(result.drift).toBeDefined();
		expect(result.drift?.removed).toEqual(["./old-module"]);
		expect(result.drift?.added).toEqual([]);
		expect(result.drift?.changed).toEqual([]);
	});

	test("detects changed export values", () => {
		const actual: ExportMap = {
			".": simpleEntry("index"),
			"./branded": simpleEntry("branded"),
		};
		const expected: ExportMap = {
			".": simpleEntry("index"),
			"./branded": {
				import: {
					types: "./dist/branded/index.d.ts",
					default: "./dist/branded/index.js",
				},
			},
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual,
			expected,
		});

		expect(result.status).toBe("drift");
		expect(result.drift).toBeDefined();
		expect(result.drift?.changed).toEqual([
			{
				key: "./branded",
				expected: expected["./branded"],
				actual: actual["./branded"],
			},
		]);
		expect(result.drift?.added).toEqual([]);
		expect(result.drift?.removed).toEqual([]);
	});

	test("detects multiple drift types simultaneously", () => {
		const actual: ExportMap = {
			".": simpleEntry("index"),
			"./old": simpleEntry("old"),
			"./changed": simpleEntry("changed"),
		};
		const expected: ExportMap = {
			".": simpleEntry("index"),
			"./new": simpleEntry("new"),
			"./changed": {
				import: {
					types: "./dist/changed/index.d.ts",
					default: "./dist/changed/index.js",
				},
			},
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual,
			expected,
		});

		expect(result.status).toBe("drift");
		expect(result.drift?.added).toEqual(["./new"]);
		expect(result.drift?.removed).toEqual(["./old"]);
		expect(result.drift?.changed).toHaveLength(1);
		expect(result.drift?.changed[0]?.key).toBe("./changed");
	});

	test("returns sorted keys in drift output", () => {
		const actual: ExportMap = {
			".": simpleEntry("index"),
		};
		const expected: ExportMap = {
			".": simpleEntry("index"),
			"./zebra": simpleEntry("zebra"),
			"./alpha": simpleEntry("alpha"),
			"./middle": simpleEntry("middle"),
		};

		const result = compareExports({
			name: "@outfitter/types",
			actual,
			expected,
		});

		expect(result.drift?.added).toEqual(["./alpha", "./middle", "./zebra"]);
	});

	test("treats string export values correctly", () => {
		const actual: ExportMap = {
			"./package.json": "./package.json",
			"./biome": "./biome.json",
		};
		const expected: ExportMap = {
			"./package.json": "./package.json",
			"./biome": "./biome.json",
		};

		const result = compareExports({
			name: "@outfitter/tooling",
			actual,
			expected,
		});

		expect(result.status).toBe("ok");
	});
});

describe("CheckResult aggregation", () => {
	test("ok is true when all packages match", () => {
		const results: CheckResult = {
			ok: true,
			packages: [
				{ name: "@outfitter/types", status: "ok" },
				{ name: "@outfitter/contracts", status: "ok" },
			],
		};

		expect(results.ok).toBe(true);
	});

	test("ok is false when any package has drift", () => {
		const results: CheckResult = {
			ok: false,
			packages: [
				{ name: "@outfitter/types", status: "ok" },
				{
					name: "@outfitter/contracts",
					status: "drift",
					drift: {
						package: "@outfitter/contracts",
						path: "packages/contracts",
						added: ["./new-export"],
						removed: [],
						changed: [],
					},
				},
			],
		};

		expect(results.ok).toBe(false);
	});
});
