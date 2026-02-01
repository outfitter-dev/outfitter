/**
 * CLI init command - Initialize tooling config in a project
 */

/** Package.json structure for framework detection */
interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

/** Options for building the ultracite command */
interface UltraciteOptions {
	frameworks?: string[];
	quiet?: boolean;
}

/** Known frameworks to detect */
const FRAMEWORK_DETECTORS: Record<string, string[]> = {
	react: ["react", "react-dom"],
	next: ["next"],
	vue: ["vue"],
	nuxt: ["nuxt"],
	svelte: ["svelte"],
	angular: ["@angular/core"],
	solid: ["solid-js"],
	astro: ["astro"],
	remix: ["@remix-run/react"],
	qwik: ["@builder.io/qwik"],
};

/**
 * Detect frameworks from package.json dependencies
 * @param pkg - Package.json contents
 * @returns Array of CLI flags for detected frameworks
 */
export function detectFrameworks(pkg: PackageJson): string[] {
	const allDeps = {
		...pkg.dependencies,
		...pkg.devDependencies,
	};

	const detected: string[] = [];

	for (const [framework, packages] of Object.entries(FRAMEWORK_DETECTORS)) {
		if (packages.some((p) => p in allDeps)) {
			detected.push(framework);
		}
	}

	if (detected.length === 0) {
		return [];
	}

	return ["--frameworks", ...detected];
}

/**
 * Build the ultracite init command with appropriate flags
 * @param options - Command options
 * @returns Array of command arguments
 */
export function buildUltraciteCommand(options: UltraciteOptions): string[] {
	const cmd = ["ultracite", "--linter", "biome", "--pm", "bun", "--quiet"];

	if (options.frameworks && options.frameworks.length > 0) {
		cmd.push("--frameworks", ...options.frameworks);
	}

	return cmd;
}

/**
 * Run the init command
 * @param cwd - Working directory
 */
export async function runInit(cwd: string = process.cwd()): Promise<void> {
	// Read package.json
	const pkgPath = `${cwd}/package.json`;
	const pkgFile = Bun.file(pkgPath);

	if (!(await pkgFile.exists())) {
		console.error("No package.json found in current directory");
		process.exit(1);
	}

	const pkg = (await pkgFile.json()) as PackageJson;

	// Detect frameworks
	const frameworkFlags = detectFrameworks(pkg);
	const frameworks =
		frameworkFlags.length > 0 ? frameworkFlags.slice(1) : []; // Remove --frameworks flag

	// Build command
	const cmd = buildUltraciteCommand({ frameworks });

	console.log(`Running: bun x ${cmd.join(" ")}`);

	// Execute ultracite
	const proc = Bun.spawn(["bun", "x", ...cmd], {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	});

	const exitCode = await proc.exited;
	process.exit(exitCode);
}
