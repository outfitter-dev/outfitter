import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initAgentDocs } from "../init.js";

describe("initAgentDocs", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "agents-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates all template files in empty directory", async () => {
		await initAgentDocs({ target: tempDir, quiet: true });

		// Check root files
		expect(await Bun.file(join(tempDir, "AGENTS.md")).exists()).toBe(true);
		expect(await Bun.file(join(tempDir, "CLAUDE.md")).exists()).toBe(true);

		// Check .claude directory
		expect(await Bun.file(join(tempDir, ".claude/CLAUDE.md")).exists()).toBe(true);
		expect(await Bun.file(join(tempDir, ".claude/settings.json")).exists()).toBe(true);
		expect(await Bun.file(join(tempDir, ".claude/hooks/bootstrap.sh")).exists()).toBe(true);
	});

	test("CLAUDE.md contains loader pattern", async () => {
		await initAgentDocs({ target: tempDir, quiet: true });

		const content = await Bun.file(join(tempDir, "CLAUDE.md")).text();

		expect(content).toContain("@.claude/CLAUDE.md");
		expect(content).toContain("@AGENTS.md");
	});

	test("settings.json contains SessionStart hook", async () => {
		await initAgentDocs({ target: tempDir, quiet: true });

		const settings = await Bun.file(join(tempDir, ".claude/settings.json")).json();

		expect(settings.hooks).toBeDefined();
		expect(settings.hooks.SessionStart).toHaveLength(1);
		expect(settings.hooks.SessionStart[0].matcher).toBe("*");
	});

	test("skips existing files without force or merge", async () => {
		// Create existing file with custom content
		const agentsPath = join(tempDir, "AGENTS.md");
		await Bun.write(agentsPath, "# My Custom AGENTS.md\n");

		await initAgentDocs({ target: tempDir, quiet: true });

		const content = await Bun.file(agentsPath).text();
		expect(content).toBe("# My Custom AGENTS.md\n");
	});

	test("overwrites existing files with force", async () => {
		// Create existing file
		const agentsPath = join(tempDir, "AGENTS.md");
		await Bun.write(agentsPath, "# Old content\n");

		await initAgentDocs({ target: tempDir, force: true, quiet: true });

		const content = await Bun.file(agentsPath).text();
		expect(content).toContain("# AGENTS.md");
		expect(content).not.toContain("Old content");
	});

	test("merges settings.json with existing hooks", async () => {
		// Create .claude directory and existing settings
		const settingsPath = join(tempDir, ".claude/settings.json");
		await Bun.write(
			settingsPath,
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "Write",
							hooks: [{ type: "command", command: "my-validator.sh" }],
						},
					],
				},
			}),
		);

		await initAgentDocs({ target: tempDir, merge: true, quiet: true });

		const settings = await Bun.file(settingsPath).json();

		// Should have both existing PreToolUse and new SessionStart
		expect(settings.hooks.PreToolUse).toHaveLength(1);
		expect(settings.hooks.PreToolUse[0].matcher).toBe("Write");
		expect(settings.hooks.SessionStart).toHaveLength(1);
	});

	test("bootstrap.sh is executable", async () => {
		await initAgentDocs({ target: tempDir, quiet: true });

		const bootstrapPath = join(tempDir, ".claude/hooks/bootstrap.sh");

		// Check executable bit (mode & 0o111 should be non-zero)
		// Note: Bun's stat doesn't expose mode directly, so we use spawnSync
		const result = Bun.spawnSync(["test", "-x", bootstrapPath]);
		expect(result.exitCode).toBe(0);
	});
});
