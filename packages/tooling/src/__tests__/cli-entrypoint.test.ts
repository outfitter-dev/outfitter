import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const decoder = new TextDecoder();
const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const toolingCliEntrypoint = fileURLToPath(
	new URL("../cli/index.ts", import.meta.url),
);

function runToolingCli(args: readonly string[]): {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
} {
	const result = Bun.spawnSync(
		[process.execPath, toolingCliEntrypoint, ...args],
		{
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	return {
		exitCode: result.exitCode,
		stdout: decoder.decode(result.stdout),
		stderr: decoder.decode(result.stderr),
	};
}

describe("tooling CLI json flag wiring", () => {
	test("shows --json in check-exports and check-readme-imports help", () => {
		const exportsHelp = runToolingCli(["check-exports", "--help"]);
		const readmeHelp = runToolingCli(["check-readme-imports", "--help"]);

		expect(exportsHelp.exitCode).toBe(0);
		expect(readmeHelp.exitCode).toBe(0);
		expect(`${exportsHelp.stdout}\n${exportsHelp.stderr}`).toContain("--json");
		expect(`${readmeHelp.stdout}\n${readmeHelp.stderr}`).toContain("--json");
	});

	test("accepts --json on tooling check commands", () => {
		const exportsResult = runToolingCli(["check-exports", "--json"]);
		const readmeResult = runToolingCli(["check-readme-imports", "--json"]);

		expect(`${exportsResult.stdout}\n${exportsResult.stderr}`).not.toContain(
			"unknown option '--json'",
		);
		expect(`${readmeResult.stdout}\n${readmeResult.stderr}`).not.toContain(
			"unknown option '--json'",
		);
		expect(exportsResult.stdout.trim().startsWith("{")).toBe(true);
		expect(readmeResult.stdout.trim().startsWith("{")).toBe(true);
	});
});
