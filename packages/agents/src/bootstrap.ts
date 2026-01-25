/**
 * Composable bootstrap for AI-ready projects.
 *
 * Ensures core tooling is installed, then allows project-specific extensions.
 */

export interface BootstrapOptions {
	/**
	 * Additional tools to install via bun global.
	 */
	tools?: string[];

	/**
	 * Project-specific setup to run after core bootstrap.
	 */
	extend?: () => Promise<void>;

	/**
	 * Skip checks and run full bootstrap.
	 */
	force?: boolean;

	/**
	 * Suppress output (for CI/hooks).
	 */
	quiet?: boolean;
}

interface ToolCheck {
	name: string;
	command: string;
	install: () => Promise<void>;
}

const CORE_TOOLS: ToolCheck[] = [
	{
		name: "gh",
		command: "gh",
		install: async () => {
			if (process.platform === "darwin") {
				await run("brew", ["install", "gh"]);
			} else {
				// biome-ignore lint/suspicious/noConsole: user-facing guidance for non-macOS installs
				console.log("    Install GitHub CLI: https://cli.github.com/");
			}
		},
	},
	{
		name: "gt",
		command: "gt",
		install: async () => {
			if (process.platform === "darwin") {
				await run("brew", ["install", "withgraphite/tap/graphite"]);
			} else {
				await run("bun", ["install", "-g", "@withgraphite/graphite-cli"]);
			}
		},
	},
	{
		name: "markdownlint-cli2",
		command: "markdownlint-cli2",
		install: async () => {
			await run("bun", ["install", "-g", "markdownlint-cli2"]);
		},
	},
];

async function run(command: string, args: string[] = []): Promise<void> {
	const result = Bun.spawnSync([command, ...args], {
		stdout: "inherit",
		stderr: "inherit",
	});
	if (result.exitCode !== 0) {
		throw new Error(`Command failed: ${command} ${args.join(" ")}`.trim());
	}
}

async function commandExists(command: string): Promise<boolean> {
	const result = Bun.spawnSync(["which", command], { stdout: "pipe" });
	return result.exitCode === 0;
}

function log(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(message);
}

function success(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(`✓ ${message}`);
}

function info(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(`▸ ${message}`);
}

/**
 * Run bootstrap with optional extensions.
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<void> {
	const { tools = [], extend, force = false, quiet = false } = options;

	// Fast path: check if everything is present
	if (!force) {
		let allPresent = true;

		for (const tool of CORE_TOOLS) {
			if (!(await commandExists(tool.command))) {
				allPresent = false;
				break;
			}
		}

		for (const tool of tools) {
			if (!(await commandExists(tool))) {
				allPresent = false;
				break;
			}
		}

		// Check node_modules directory exists
		const nodeModulesCheck = Bun.spawnSync(["test", "-d", "node_modules"]);
		if (nodeModulesCheck.exitCode !== 0) {
			allPresent = false;
		}

		if (allPresent) {
			return; // Everything present, exit fast
		}
	}

	// Full bootstrap
	log(`\nOutfitter Bootstrap\n${"─".repeat(20)}\n`, quiet);

	// Core tools
	for (const tool of CORE_TOOLS) {
		if (await commandExists(tool.command)) {
			success(`${tool.name} installed`, quiet);
		} else {
			info(`Installing ${tool.name}...`, quiet);
			await tool.install();
			success(`${tool.name} installed`, quiet);
		}
	}

	// Additional tools
	for (const tool of tools) {
		if (await commandExists(tool)) {
			success(`${tool} installed`, quiet);
		} else {
			info(`Installing ${tool}...`, quiet);
			await run("bun", ["install", "-g", tool]);
			success(`${tool} installed`, quiet);
		}
	}

	// Check auth
	log("", quiet);
	info("Checking authentication...", quiet);

	// biome-ignore lint/complexity/useLiteralKeys: env access requires index signature
	const ghToken = process.env["GH_TOKEN"];
	// biome-ignore lint/complexity/useLiteralKeys: env access requires index signature
	const githubToken = process.env["GITHUB_TOKEN"];

	if (ghToken || githubToken) {
		success("GitHub CLI token found", quiet);
	} else if ((await Bun.spawnSync(["gh", "auth", "status"])).exitCode === 0) {
		success("GitHub CLI authenticated", quiet);
	} else {
		log("    GitHub CLI not authenticated. Run 'gh auth login' or set GH_TOKEN", quiet);
	}

	// biome-ignore lint/complexity/useLiteralKeys: env access requires index signature
	const gtAuthToken = process.env["GT_AUTH_TOKEN"];

	if (gtAuthToken) {
		info("Authenticating Graphite CLI...", quiet);
		await run("gt", ["auth", "--token", gtAuthToken]);
		success("Graphite CLI authenticated", quiet);
	} else if ((await Bun.spawnSync(["gt", "auth", "status"])).exitCode === 0) {
		success("Graphite CLI authenticated", quiet);
	} else {
		log("    Graphite CLI not authenticated. Run 'gt auth' or set GT_AUTH_TOKEN", quiet);
	}

	// Project dependencies
	log("", quiet);
	info("Installing project dependencies...", quiet);
	await run("bun", ["install"]);
	success("Dependencies installed", quiet);

	// Project-specific extensions
	if (extend) {
		log("", quiet);
		info("Running project extensions...", quiet);
		await extend();
		success("Extensions complete", quiet);
	}

	log("\n✓ Bootstrap complete!\n", quiet);
}
