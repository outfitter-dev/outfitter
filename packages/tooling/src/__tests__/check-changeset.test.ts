import { describe, expect, test } from "bun:test";
import {
	checkChangesetRequired,
	getChangedPackagePaths,
} from "../cli/check-changeset.js";

describe("getChangedPackagePaths", () => {
	test("extracts unique package names from packages/*/src/** paths", () => {
		const files = [
			"packages/cli/src/index.ts",
			"packages/cli/src/utils.ts",
			"packages/contracts/src/result.ts",
		];
		expect(getChangedPackagePaths(files)).toEqual(["cli", "contracts"]);
	});

	test("ignores apps/ and root-level files", () => {
		const files = [
			"apps/outfitter/src/index.ts",
			"package.json",
			"README.md",
			".changeset/some-change.md",
			"packages/cli/src/index.ts",
		];
		expect(getChangedPackagePaths(files)).toEqual(["cli"]);
	});

	test("ignores packages/ files outside src/", () => {
		const files = [
			"packages/cli/package.json",
			"packages/cli/tsconfig.json",
			"packages/cli/README.md",
		];
		expect(getChangedPackagePaths(files)).toEqual([]);
	});

	test("returns sorted unique names", () => {
		const files = [
			"packages/types/src/branded.ts",
			"packages/cli/src/index.ts",
			"packages/types/src/index.ts",
			"packages/cli/src/output.ts",
		];
		expect(getChangedPackagePaths(files)).toEqual(["cli", "types"]);
	});

	test("returns empty array for no matching files", () => {
		const files = ["README.md", ".github/workflows/ci.yml"];
		expect(getChangedPackagePaths(files)).toEqual([]);
	});

	test("handles deeply nested src paths", () => {
		const files = ["packages/daemon/src/ipc/health/check.ts"];
		expect(getChangedPackagePaths(files)).toEqual(["daemon"]);
	});
});

describe("checkChangesetRequired", () => {
	test("returns ok when changeset files exist", () => {
		const result = checkChangesetRequired(
			["cli", "contracts"],
			["happy-turtle.md"],
		);
		expect(result).toEqual({ ok: true, missingFor: [] });
	});

	test("returns ok when multiple changeset files exist", () => {
		const result = checkChangesetRequired(
			["cli"],
			["happy-turtle.md", "brave-fox.md"],
		);
		expect(result).toEqual({ ok: true, missingFor: [] });
	});

	test("fails when packages changed but no changeset files", () => {
		const result = checkChangesetRequired(["cli", "contracts"], []);
		expect(result).toEqual({
			ok: false,
			missingFor: ["cli", "contracts"],
		});
	});

	test("returns ok when no packages changed", () => {
		const result = checkChangesetRequired([], []);
		expect(result).toEqual({ ok: true, missingFor: [] });
	});

	test("returns ok when no packages changed even with changesets", () => {
		const result = checkChangesetRequired([], ["happy-turtle.md"]);
		expect(result).toEqual({ ok: true, missingFor: [] });
	});
});
