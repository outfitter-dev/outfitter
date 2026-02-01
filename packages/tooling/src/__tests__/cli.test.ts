import { describe, expect, test } from "bun:test";

// Test the CLI utility functions (exported from cli/init.ts, cli/check.ts, cli/fix.ts)
// We'll test the pure functions that generate commands, not the actual execution

describe("CLI init command", () => {
	// Import the function once module is created
	test("detectFrameworks identifies React", async () => {
		const { detectFrameworks } = await import("../cli/init.js");
		const flags = detectFrameworks({ dependencies: { react: "^18.0.0" } });
		expect(flags).toContain("--frameworks");
		expect(flags).toContain("react");
	});

	test("detectFrameworks identifies Next.js", async () => {
		const { detectFrameworks } = await import("../cli/init.js");
		const flags = detectFrameworks({ dependencies: { next: "^14.0.0" } });
		expect(flags).toContain("--frameworks");
		expect(flags).toContain("next");
	});

	test("detectFrameworks handles no frameworks", async () => {
		const { detectFrameworks } = await import("../cli/init.js");
		const flags = detectFrameworks({ dependencies: {} });
		expect(flags).not.toContain("--frameworks");
	});

	test("buildUltraciteCommand generates correct base flags", async () => {
		const { buildUltraciteCommand } = await import("../cli/init.js");
		const cmd = buildUltraciteCommand({});
		expect(cmd).toContain("--linter");
		expect(cmd).toContain("biome");
		expect(cmd).toContain("--pm");
		expect(cmd).toContain("bun");
		expect(cmd).toContain("--quiet");
	});

	test("buildUltraciteCommand includes framework flags", async () => {
		const { buildUltraciteCommand } = await import("../cli/init.js");
		const cmd = buildUltraciteCommand({
			frameworks: ["react", "next"],
		});
		expect(cmd).toContain("--frameworks");
		expect(cmd).toContain("react");
		expect(cmd).toContain("next");
	});
});

describe("CLI check command", () => {
	test("buildCheckCommand generates correct command", async () => {
		const { buildCheckCommand } = await import("../cli/check.js");
		const cmd = buildCheckCommand({});
		expect(cmd).toContain("ultracite");
		expect(cmd).toContain("check");
	});

	test("buildCheckCommand passes through paths", async () => {
		const { buildCheckCommand } = await import("../cli/check.js");
		const cmd = buildCheckCommand({ paths: ["src/", "lib/"] });
		expect(cmd).toContain("src/");
		expect(cmd).toContain("lib/");
	});
});

describe("CLI fix command", () => {
	test("buildFixCommand generates correct command", async () => {
		const { buildFixCommand } = await import("../cli/fix.js");
		const cmd = buildFixCommand({});
		expect(cmd).toContain("ultracite");
		expect(cmd).toContain("fix");
	});

	test("buildFixCommand passes through paths", async () => {
		const { buildFixCommand } = await import("../cli/fix.js");
		const cmd = buildFixCommand({ paths: ["src/", "lib/"] });
		expect(cmd).toContain("src/");
		expect(cmd).toContain("lib/");
	});
});
