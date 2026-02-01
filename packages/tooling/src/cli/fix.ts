/**
 * CLI fix command - Fix linting issues (wraps ultracite)
 */

/** Options for the fix command */
interface FixOptions {
	paths?: string[];
}

/**
 * Build the ultracite fix command
 * @param options - Command options
 * @returns Array of command arguments
 */
export function buildFixCommand(options: FixOptions): string[] {
	const cmd = ["ultracite", "fix"];

	if (options.paths && options.paths.length > 0) {
		cmd.push(...options.paths);
	}

	return cmd;
}

/**
 * Run the fix command
 * @param paths - Paths to fix
 */
export async function runFix(paths: string[] = []): Promise<void> {
	const cmd = buildFixCommand({ paths });

	console.log(`Running: bun x ${cmd.join(" ")}`);

	const proc = Bun.spawn(["bun", "x", ...cmd], {
		stdio: ["inherit", "inherit", "inherit"],
	});

	const exitCode = await proc.exited;
	process.exit(exitCode);
}
