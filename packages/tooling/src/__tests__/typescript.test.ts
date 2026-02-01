import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "../..");
const TSCONFIG_BASE_PATH = join(PACKAGE_ROOT, "tsconfig.preset.json");
const TSCONFIG_BUN_PATH = join(PACKAGE_ROOT, "tsconfig.preset.bun.json");

describe("tsconfig.preset.json (base)", () => {
	test("tsconfig.preset.json exists and is valid JSON", async () => {
		const file = Bun.file(TSCONFIG_BASE_PATH);
		expect(await file.exists()).toBe(true);

		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("has $schema for editor support", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.$schema).toContain("tsconfig");
	});

	test("has strict mode enabled", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.compilerOptions?.strict).toBe(true);
	});

	test("has noUncheckedIndexedAccess for safer indexing", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.compilerOptions?.noUncheckedIndexedAccess).toBe(true);
	});

	test("has exactOptionalPropertyTypes for stricter optional props", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.compilerOptions?.exactOptionalPropertyTypes).toBe(true);
	});

	test("uses ESNext target and module", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.compilerOptions?.target).toBe("ESNext");
		expect(content.compilerOptions?.module).toBe("ESNext");
	});

	test("uses verbatimModuleSyntax", async () => {
		const content = await Bun.file(TSCONFIG_BASE_PATH).json();
		expect(content.compilerOptions?.verbatimModuleSyntax).toBe(true);
	});
});

describe("tsconfig.preset.bun.json", () => {
	test("tsconfig.preset.bun.json exists and is valid JSON", async () => {
		const file = Bun.file(TSCONFIG_BUN_PATH);
		expect(await file.exists()).toBe(true);

		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("extends the base tsconfig preset", async () => {
		const content = await Bun.file(TSCONFIG_BUN_PATH).json();
		expect(content.extends).toBe("./tsconfig.preset.json");
	});

	test("has @types/bun in types", async () => {
		const content = await Bun.file(TSCONFIG_BUN_PATH).json();
		expect(content.compilerOptions?.types).toContain("@types/bun");
	});
});
