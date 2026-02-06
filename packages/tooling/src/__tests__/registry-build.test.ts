import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RegistrySchema } from "../registry/schema.js";

/**
 * Tests for the registry build output.
 * These tests validate the generated registry.json.
 */
describe("Registry Build Output", () => {
	const registryPath = join(
		import.meta.dirname,
		"../../registry/registry.json"
	);

	test("registry.json exists", () => {
		expect(existsSync(registryPath)).toBe(true);
	});

	test("registry.json is valid against schema", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = JSON.parse(content);
		const result = RegistrySchema.safeParse(registry);
		expect(result.success).toBe(true);
	});

	test("registry contains expected blocks", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		expect(registry.blocks.claude).toBeDefined();
		expect(registry.blocks.biome).toBeDefined();
		expect(registry.blocks.lefthook).toBeDefined();
		expect(registry.blocks.bootstrap).toBeDefined();
		expect(registry.blocks.scaffolding).toBeDefined();
	});

	test("claude block has expected files", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		const claude = registry.blocks.claude;
		expect(claude.files).toHaveLength(2);

		const paths = claude.files?.map((f) => f.path) ?? [];
		expect(paths).toContain(".claude/settings.json");
		expect(paths).toContain(".claude/hooks/format-code-on-stop.sh");
	});

	test("biome block has devDependencies", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		const biome = registry.blocks.biome;
		expect(biome.devDependencies).toBeDefined();
		expect(biome.devDependencies?.ultracite).toBeDefined();
	});

	test("markdownlint block has correct file", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		const markdownlint = registry.blocks.markdownlint;
		expect(markdownlint).toBeDefined();
		expect(markdownlint.files).toHaveLength(1);
		expect(markdownlint.files?.[0]?.path).toBe(".markdownlint-cli2.jsonc");
	});

	test("scaffolding block extends other blocks", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		const scaffolding = registry.blocks.scaffolding;
		expect(scaffolding.extends).toEqual([
			"claude",
			"biome",
			"lefthook",
			"markdownlint",
			"bootstrap",
		]);
		expect(scaffolding.files).toBeUndefined();
	});

	test("executable files have executable flag", () => {
		const content = readFileSync(registryPath, "utf-8");
		const registry = RegistrySchema.parse(JSON.parse(content));

		// Check format hook is marked executable
		const formatHook = registry.blocks.claude.files?.find((f) =>
			f.path.includes("format-code-on-stop.sh")
		);
		expect(formatHook?.executable).toBe(true);

		// Check bootstrap is marked executable
		const bootstrap = registry.blocks.bootstrap.files?.find((f) =>
			f.path.includes("bootstrap.sh")
		);
		expect(bootstrap?.executable).toBe(true);
	});
});
