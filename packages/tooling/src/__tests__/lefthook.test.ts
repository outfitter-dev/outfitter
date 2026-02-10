import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const PACKAGE_ROOT = join(import.meta.dir, "../..");
const LEFTHOOK_PATH = join(PACKAGE_ROOT, "lefthook.yml");

describe("lefthook.yml preset", () => {
	test("lefthook.yml exists and is valid YAML", async () => {
		const file = Bun.file(LEFTHOOK_PATH);
		expect(await file.exists()).toBe(true);

		const content = await file.text();
		const parsed = parseYaml(content);
		expect(parsed).toBeDefined();
	});

	test("matches snapshot", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		expect(parsed).toMatchSnapshot();
	});

	test("has pre-commit hooks", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		expect(parsed["pre-commit"]).toBeDefined();
	});

	test("has pre-push hooks", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		expect(parsed["pre-push"]).toBeDefined();
	});

	test("pre-commit includes ultracite/linting", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		const preCommit = parsed["pre-commit"];

		// Check for lint/format command
		const commands = preCommit?.commands ?? {};
		const hasLinting = Object.values(commands).some(
			(cmd: unknown) =>
				typeof cmd === "object" &&
				cmd !== null &&
				"run" in cmd &&
				typeof (cmd as { run: unknown }).run === "string" &&
				(cmd as { run: string }).run.includes("ultracite"),
		);

		expect(hasLinting).toBe(true);
	});

	test("pre-commit includes typecheck", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		const preCommit = parsed["pre-commit"];

		const commands = preCommit?.commands ?? {};
		const hasTypecheck = Object.values(commands).some(
			(cmd: unknown) =>
				typeof cmd === "object" &&
				cmd !== null &&
				"run" in cmd &&
				typeof (cmd as { run: unknown }).run === "string" &&
				(cmd as { run: string }).run.includes("typecheck"),
		);

		expect(hasTypecheck).toBe(true);
	});

	test("pre-push uses tooling pre-push command", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		const prePush = parsed["pre-push"];

		const commands = prePush?.commands ?? {};
		const hasToolingPrePush = Object.values(commands).some(
			(cmd: unknown) =>
				typeof cmd === "object" &&
				cmd !== null &&
				"run" in cmd &&
				typeof (cmd as { run: unknown }).run === "string" &&
				(cmd as { run: string }).run.includes("@outfitter/tooling pre-push"),
		);

		expect(hasToolingPrePush).toBe(true);
	});

	test("pre-push references strict verification flow", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		const prePush = parsed["pre-push"];

		const commands = prePush?.commands ?? {};
		const hasStrictVerifyReference = Object.values(commands).some(
			(cmd: unknown) =>
				typeof cmd === "object" &&
				cmd !== null &&
				"run" in cmd &&
				typeof (cmd as { run: unknown }).run === "string" &&
				(cmd as { run: string }).run.includes("pre-push"),
		);

		expect(hasStrictVerifyReference).toBe(true);
	});

	test("pre-commit runs in parallel", async () => {
		const content = await Bun.file(LEFTHOOK_PATH).text();
		const parsed = parseYaml(content);
		expect(parsed["pre-commit"]?.parallel).toBe(true);
	});
});
