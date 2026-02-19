import { describe, expect, test } from "bun:test";
import {
	extractBunupFilterName,
	findUnregisteredPackages,
	type RegistryCheckResult,
} from "../cli/check-bunup-registry.js";

describe("extractBunupFilterName", () => {
	test("returns package name from simple bunup --filter script", () => {
		expect(extractBunupFilterName("bunup --filter @outfitter/logging")).toBe(
			"@outfitter/logging",
		);
	});

	test("returns package name when cd precedes bunup", () => {
		expect(
			extractBunupFilterName("cd ../.. && bunup --filter @outfitter/types"),
		).toBe("@outfitter/types");
	});

	test("returns null for scripts without bunup --filter", () => {
		expect(extractBunupFilterName("tsc --noEmit")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(extractBunupFilterName("")).toBeNull();
	});

	test("returns null for bunup without --filter flag", () => {
		expect(extractBunupFilterName("bunup")).toBeNull();
	});

	test("returns unscoped package name", () => {
		expect(extractBunupFilterName("bunup --filter outfitter")).toBe(
			"outfitter",
		);
	});
});

describe("findUnregisteredPackages", () => {
	test("returns empty when all packages are registered", () => {
		const result = findUnregisteredPackages(
			["@outfitter/cli", "@outfitter/types"],
			["@outfitter/cli", "@outfitter/types", "@outfitter/contracts"],
		);
		expect(result).toEqual<RegistryCheckResult>({
			ok: true,
			missing: [],
		});
	});

	test("returns missing packages", () => {
		const result = findUnregisteredPackages(
			["@outfitter/cli", "@outfitter/logging", "@outfitter/daemon"],
			["@outfitter/cli"],
		);
		expect(result).toEqual<RegistryCheckResult>({
			ok: false,
			missing: ["@outfitter/daemon", "@outfitter/logging"],
		});
	});

	test("returns sorted missing packages", () => {
		const result = findUnregisteredPackages(
			["@outfitter/state", "@outfitter/mcp", "@outfitter/daemon"],
			[],
		);
		expect(result.missing).toEqual([
			"@outfitter/daemon",
			"@outfitter/mcp",
			"@outfitter/state",
		]);
	});

	test("handles empty inputs", () => {
		expect(findUnregisteredPackages([], [])).toEqual<RegistryCheckResult>({
			ok: true,
			missing: [],
		});
	});

	test("handles all packages missing", () => {
		const result = findUnregisteredPackages(["@outfitter/logging"], []);
		expect(result).toEqual<RegistryCheckResult>({
			ok: false,
			missing: ["@outfitter/logging"],
		});
	});
});
