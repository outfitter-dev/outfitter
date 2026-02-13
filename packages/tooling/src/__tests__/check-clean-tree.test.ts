import { describe, expect, test } from "bun:test";
import {
	isCleanTree,
	parseGitDiff,
	parseUntrackedFiles,
	type TreeStatus,
} from "../cli/check-clean-tree.js";

describe("parseGitDiff", () => {
	test("returns empty array for empty output", () => {
		expect(parseGitDiff("")).toEqual([]);
	});

	test("returns empty array for whitespace-only output", () => {
		expect(parseGitDiff("  \n  \n")).toEqual([]);
	});

	test("parses single modified file", () => {
		expect(parseGitDiff("packages/cli/dist/index.js\n")).toEqual([
			"packages/cli/dist/index.js",
		]);
	});

	test("parses multiple modified files", () => {
		const output = [
			"packages/cli/dist/index.js",
			"packages/types/dist/branded.d.ts",
			"docs/llms.txt",
		].join("\n");

		expect(parseGitDiff(output)).toEqual([
			"packages/cli/dist/index.js",
			"packages/types/dist/branded.d.ts",
			"docs/llms.txt",
		]);
	});

	test("trims whitespace from file paths", () => {
		expect(parseGitDiff("  foo.ts  \n  bar.ts  \n")).toEqual([
			"foo.ts",
			"bar.ts",
		]);
	});
});

describe("parseUntrackedFiles", () => {
	test("returns empty array for empty output", () => {
		expect(parseUntrackedFiles("")).toEqual([]);
	});

	test("returns empty array for whitespace-only output", () => {
		expect(parseUntrackedFiles("  \n  \n")).toEqual([]);
	});

	test("parses single untracked file", () => {
		expect(parseUntrackedFiles("dist/new-file.js\n")).toEqual([
			"dist/new-file.js",
		]);
	});

	test("parses multiple untracked files", () => {
		const output = ["dist/new-file.js", "packages/cli/dist/foo.js"].join("\n");

		expect(parseUntrackedFiles(output)).toEqual([
			"dist/new-file.js",
			"packages/cli/dist/foo.js",
		]);
	});
});

describe("isCleanTree", () => {
	test("returns true when no modified or untracked files", () => {
		const status: TreeStatus = {
			clean: true,
			modified: [],
			untracked: [],
		};
		expect(isCleanTree(status)).toBe(true);
	});

	test("returns false when modified files exist", () => {
		const status: TreeStatus = {
			clean: false,
			modified: ["packages/cli/dist/index.js"],
			untracked: [],
		};
		expect(isCleanTree(status)).toBe(false);
	});

	test("returns false when untracked files exist", () => {
		const status: TreeStatus = {
			clean: false,
			modified: [],
			untracked: ["dist/new-file.js"],
		};
		expect(isCleanTree(status)).toBe(false);
	});

	test("returns false when both modified and untracked files exist", () => {
		const status: TreeStatus = {
			clean: false,
			modified: ["packages/cli/dist/index.js"],
			untracked: ["dist/new-file.js"],
		};
		expect(isCleanTree(status)).toBe(false);
	});
});
