import { describe, expect, test } from "bun:test";
import { buildSyncedExports, shortAlias, sortExports } from "../sync-exports";

describe("shortAlias", () => {
	test("biome.json returns biome", () => {
		expect(shortAlias("biome.json")).toBe("biome");
	});

	test("tsconfig.preset.json returns tsconfig", () => {
		expect(shortAlias("tsconfig.preset.json")).toBe("tsconfig");
	});

	test("tsconfig.preset.bun.json returns tsconfig-bun", () => {
		expect(shortAlias("tsconfig.preset.bun.json")).toBe("tsconfig-bun");
	});

	test("lefthook.yml returns lefthook", () => {
		expect(shortAlias("lefthook.yml")).toBe("lefthook");
	});

	test(".markdownlint-cli2.jsonc returns .markdownlint-cli2", () => {
		expect(shortAlias(".markdownlint-cli2.jsonc")).toBe(".markdownlint-cli2");
	});

	test("foo.toml returns foo", () => {
		expect(shortAlias("foo.toml")).toBe("foo");
	});
});

describe("sortExports", () => {
	test("sorts export keys deterministically", () => {
		const sorted = sortExports({
			"./z": "./z.js",
			".": "./index.js",
			"./a": "./a.js",
		});

		expect(Object.keys(sorted)).toEqual([".", "./a", "./z"]);
	});
});

describe("buildSyncedExports", () => {
	test("removes stale config exports and regenerates from files", () => {
		const synced = buildSyncedExports({
			files: [
				"dist",
				"biome.json",
				"tsconfig.preset.json",
				"tsconfig.preset.bun.json",
				"lefthook.yml",
				".markdownlint-cli2.jsonc",
			],
			exports: {
				"./cli/check": {
					import: {
						types: "./dist/cli/check.d.ts",
						default: "./dist/cli/check.js",
					},
				},
				"./biome": "./stale.json",
				"./biome.json": "./stale.json",
				"./tsconfig": "./stale.json",
				"./tsconfig.preset.json": "./stale.json",
				"./package.json": "./package.json",
				".": {
					import: {
						types: "./dist/index.d.ts",
						default: "./dist/index.js",
					},
				},
			},
		});

		expect(synced["./biome"]).toBe("./biome.json");
		expect(synced["./biome.json"]).toBe("./biome.json");
		expect(synced["./tsconfig"]).toBe("./tsconfig.preset.json");
		expect(synced["./tsconfig.preset.json"]).toBe("./tsconfig.preset.json");
		expect(synced["./tsconfig-bun"]).toBe("./tsconfig.preset.bun.json");
		expect(synced["./lefthook"]).toBe("./lefthook.yml");
		expect(synced["./.markdownlint-cli2"]).toBe("./.markdownlint-cli2.jsonc");
		expect(Object.keys(synced)).toEqual([
			".",
			"./.markdownlint-cli2",
			"./.markdownlint-cli2.jsonc",
			"./biome",
			"./biome.json",
			"./cli/check",
			"./lefthook",
			"./lefthook.yml",
			"./package.json",
			"./tsconfig",
			"./tsconfig-bun",
			"./tsconfig.preset.bun.json",
			"./tsconfig.preset.json",
		]);
	});
});
