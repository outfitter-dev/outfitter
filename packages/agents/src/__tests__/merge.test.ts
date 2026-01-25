import { describe, expect, test } from "bun:test";
import { mergeSettings, type SettingsJson } from "../merge.js";

describe("mergeSettings", () => {
	test("returns defaults when existing is empty", () => {
		const existing: SettingsJson = {};
		const defaults: SettingsJson = {
			hooks: {
				SessionStart: [
					{
						matcher: "*",
						hooks: [{ type: "command", command: "echo hello" }],
					},
				],
			},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.SessionStart).toHaveLength(1);
		expect(result.hooks?.SessionStart?.[0]?.matcher).toBe("*");
	});

	test("preserves existing when defaults is empty", () => {
		const existing: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Write",
						hooks: [{ type: "prompt", prompt: "Validate write" }],
					},
				],
			},
		};
		const defaults: SettingsJson = {};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.PreToolUse).toHaveLength(1);
		expect(result.hooks?.PreToolUse?.[0]?.matcher).toBe("Write");
	});

	test("combines hooks for different matchers", () => {
		const existing: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "validate-write.sh" }],
					},
				],
			},
		};
		const defaults: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "validate-bash.sh" }],
					},
				],
			},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.PreToolUse).toHaveLength(2);
		const matchers = result.hooks?.PreToolUse?.map((m) => m.matcher);
		expect(matchers).toContain("Write");
		expect(matchers).toContain("Bash");
	});

	test("merges hooks for same matcher", () => {
		const existing: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "check1.sh" }],
					},
				],
			},
		};
		const defaults: SettingsJson = {
			hooks: {
				PreToolUse: [
					{
						matcher: "Write",
						hooks: [{ type: "command", command: "check2.sh" }],
					},
				],
			},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.PreToolUse).toHaveLength(1);
		expect(result.hooks?.PreToolUse?.[0]?.hooks).toHaveLength(2);
	});

	test("deduplicates identical hooks", () => {
		const existing: SettingsJson = {
			hooks: {
				SessionStart: [
					{
						matcher: "*",
						hooks: [{ type: "command", command: "bootstrap.sh" }],
					},
				],
			},
		};
		const defaults: SettingsJson = {
			hooks: {
				SessionStart: [
					{
						matcher: "*",
						hooks: [{ type: "command", command: "bootstrap.sh" }],
					},
				],
			},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.SessionStart).toHaveLength(1);
		expect(result.hooks?.SessionStart?.[0]?.hooks).toHaveLength(1);
	});

	test("preserves non-hook settings from existing", () => {
		const existing: SettingsJson = {
			customSetting: "user-value",
			hooks: {},
		};
		const defaults: SettingsJson = {
			customSetting: "default-value",
			hooks: {},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.customSetting).toBe("user-value");
	});

	test("merges multiple hook events", () => {
		const existing: SettingsJson = {
			hooks: {
				PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "a.sh" }] }],
			},
		};
		const defaults: SettingsJson = {
			hooks: {
				SessionStart: [{ matcher: "*", hooks: [{ type: "command", command: "b.sh" }] }],
				Stop: [{ matcher: "*", hooks: [{ type: "prompt", prompt: "Check done" }] }],
			},
		};

		const result = mergeSettings(existing, defaults);

		expect(result.hooks?.PreToolUse).toHaveLength(1);
		expect(result.hooks?.SessionStart).toHaveLength(1);
		expect(result.hooks?.Stop).toHaveLength(1);
	});
});
