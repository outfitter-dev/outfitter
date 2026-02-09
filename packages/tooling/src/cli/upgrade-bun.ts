/**
 * Bun version upgrade command
 *
 * Updates:
 *   - .bun-version
 *   - engines.bun in package.json files
 *   - Pinned @types/bun versions (leaves "latest" alone)
 *   - bun.lock
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COLORS = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
};

function log(msg: string): void {
	process.stdout.write(`${msg}\n`);
}

function info(msg: string): void {
	process.stdout.write(`${COLORS.blue}▸${COLORS.reset} ${msg}\n`);
}

function success(msg: string): void {
	process.stdout.write(`${COLORS.green}✓${COLORS.reset} ${msg}\n`);
}

function warn(msg: string): void {
	process.stdout.write(`${COLORS.yellow}!${COLORS.reset} ${msg}\n`);
}

/**
 * Fetch the latest Bun version from GitHub releases
 */
async function fetchLatestVersion(): Promise<string> {
	const response = await fetch(
		"https://api.github.com/repos/oven-sh/bun/releases/latest",
	);
	const data = (await response.json()) as { tag_name: string };
	// tag_name is like "bun-v1.4.0", extract version
	const match = data.tag_name.match(/bun-v(.+)/);
	if (!match?.[1]) {
		throw new Error(`Could not parse version from tag: ${data.tag_name}`);
	}
	return match[1];
}

/**
 * Find all package.json files (excluding node_modules)
 */
function findPackageJsonFiles(dir: string): string[] {
	const results: string[] = [];
	const glob = new Bun.Glob("**/package.json");

	for (const path of glob.scanSync({ cwd: dir })) {
		if (!path.includes("node_modules")) {
			results.push(join(dir, path));
		}
	}

	return results;
}

/**
 * Update engines.bun in a package.json file
 */
function updateEnginesBun(filePath: string, version: string): boolean {
	const content = readFileSync(filePath, "utf-8");
	const pattern = /"bun":\s*">=[\d.]+"/;

	if (!pattern.test(content)) {
		return false;
	}

	const updated = content.replace(pattern, `"bun": ">=${version}"`);
	if (updated !== content) {
		writeFileSync(filePath, updated);
		return true;
	}
	return false;
}

/**
 * Update @types/bun in a package.json file (skip "latest")
 */
function updateTypesBun(filePath: string, version: string): boolean {
	const content = readFileSync(filePath, "utf-8");
	const pattern = /"@types\/bun":\s*"\^[\d.]+"/;

	if (!pattern.test(content)) {
		return false;
	}

	const updated = content.replace(pattern, `"@types/bun": "^${version}"`);
	if (updated !== content) {
		writeFileSync(filePath, updated);
		return true;
	}
	return false;
}

export interface UpgradeBunOptions {
	install?: boolean;
}

/**
 * Main upgrade-bun command
 */
export async function runUpgradeBun(
	targetVersion?: string,
	options: UpgradeBunOptions = {},
): Promise<void> {
	const cwd = process.cwd();
	const bunVersionFile = join(cwd, ".bun-version");

	// Determine target version
	let version = targetVersion;
	if (!version) {
		info("Fetching latest Bun version...");
		version = await fetchLatestVersion();
		log(`Latest version: ${version}`);
	}

	// Check current version
	const currentVersion = existsSync(bunVersionFile)
		? readFileSync(bunVersionFile, "utf-8").trim()
		: "unknown";
	log(`Current version: ${currentVersion}`);

	if (currentVersion === version) {
		success(`Already on version ${version}`);
		return;
	}

	log("");
	info(`Upgrading Bun: ${currentVersion} → ${version}`);
	log("");

	// Update .bun-version
	writeFileSync(bunVersionFile, `${version}\n`);
	success("Updated .bun-version");

	// Find and update package.json files
	const packageFiles = findPackageJsonFiles(cwd);

	info("Updating engines.bun...");
	for (const file of packageFiles) {
		if (updateEnginesBun(file, version)) {
			log(`  ${file.replace(`${cwd}/`, "")}`);
		}
	}

	info("Updating @types/bun...");
	for (const file of packageFiles) {
		if (updateTypesBun(file, version)) {
			log(`  ${file.replace(`${cwd}/`, "")}`);
		}
	}

	// Optionally install new version and update lockfile
	if (options.install !== false) {
		log("");
		info(`Installing Bun ${version}...`);

		const installResult = Bun.spawnSync([
			"bash",
			"-c",
			`curl -fsSL https://bun.sh/install | bash -s "bun-v${version}"`,
		]);

		if (installResult.exitCode !== 0) {
			warn("Could not install Bun automatically");
			log("Install manually: curl -fsSL https://bun.sh/install | bash");
		} else {
			success(`Bun ${version} installed`);

			log("");
			info("Updating lockfile...");
			const bunInstall = Bun.spawnSync(["bun", "install"], {
				cwd,
				env: {
					...process.env,
					BUN_INSTALL: `${process.env["HOME"]}/.bun`,
					PATH: `${process.env["HOME"]}/.bun/bin:${process.env["PATH"]}`,
				},
			});

			if (bunInstall.exitCode === 0) {
				success("Lockfile updated");
			} else {
				warn("Could not update lockfile - run 'bun install' manually");
			}
		}
	}

	log("");
	success("Done! Changes ready to commit:");
	log("  - .bun-version");
	log("  - package.json files (engines.bun, @types/bun)");
	log("  - bun.lock");
	log("");
	log(
		`Commit with: git add -A && git commit -m 'chore: upgrade Bun to ${version}'`,
	);
}
