import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dir, "../..");
const BIOME_PATH = join(PACKAGE_ROOT, "biome.json");

describe("biome.json preset", () => {
	test("biome.json exists and is valid JSON", async () => {
		const file = Bun.file(BIOME_PATH);
		expect(await file.exists()).toBe(true);

		const content = await file.json();
		expect(content).toBeDefined();
	});

	test("matches snapshot", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content).toMatchSnapshot();
	});

	test("has $schema for editor support", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content.$schema).toContain("biome");
	});

	test("has linter rules section", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content.linter?.rules).toBeDefined();
	});

	test("noConsole is set to error", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content.linter.rules.suspicious.noConsole).toBe("error");
	});

	test("includes Bun global", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content.javascript?.globals).toContain("Bun");
	});

	test("has VCS configuration for git", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		expect(content.vcs?.enabled).toBe(true);
		expect(content.vcs?.clientKind).toBe("git");
	});

	test("ignores common build artifacts", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		const includes = content.files?.includes ?? [];
		expect(includes).toContain("!**/node_modules");
		expect(includes).toContain("!**/dist");
	});

	test("has test file overrides for noConsole", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		const overrides = content.overrides ?? [];
		const testOverride = overrides.find((o: { includes?: string[] }) =>
			o.includes?.some((i: string) => i.includes("test")),
		);

		expect(testOverride).toBeDefined();
		expect(testOverride?.linter?.rules?.suspicious?.noConsole).toBe("off");
	});

	test("allows barrel files in index.ts", async () => {
		const content = await Bun.file(BIOME_PATH).json();
		const overrides = content.overrides ?? [];
		const indexOverride = overrides.find((o: { includes?: string[] }) =>
			o.includes?.some((i: string) => i.includes("index.ts")),
		);

		expect(indexOverride).toBeDefined();
		expect(indexOverride?.linter?.rules?.performance?.noBarrelFile).toBe("off");
	});
});
