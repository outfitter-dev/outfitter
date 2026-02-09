/**
 * CLI check command - Run linting checks (wraps ultracite)
 */

/** Options for the check command */
interface CheckOptions {
	paths?: string[];
}

/**
 * Build the ultracite check command
 * @param options - Command options
 * @returns Array of command arguments
 */
export function buildCheckCommand(options: CheckOptions): string[] {
	const cmd = ["ultracite", "check"];

	if (options.paths && options.paths.length > 0) {
		cmd.push(...options.paths);
	}

	return cmd;
}

/**
 * Run the check command
 * @param paths - Paths to check
 */
export async function runCheck(paths: string[] = []): Promise<void> {
	const cmd = buildCheckCommand({ paths });

	process.stdout.write(`Running: bun x ${cmd.join(" ")}\n`);

	const proc = Bun.spawn(["bun", "x", ...cmd], {
		stdio: ["inherit", "inherit", "inherit"],
	});

	const exitCode = await proc.exited;
	process.exit(exitCode);
}
