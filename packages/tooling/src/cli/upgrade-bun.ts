/**
 * Bun version upgrade command
 *
 * Updates:
 *   - .bun-version
 *   - packageManager in package.json files
 *   - engines.bun in package.json files
 *   - Pinned @types/bun versions (leaves "latest" alone)
 *   - bun.lock
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  isTypesBunVersionCompatible,
  parseSemver,
  type ParsedSemver,
} from "../bun-version-compat.js";

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
    "https://api.github.com/repos/oven-sh/bun/releases/latest"
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
 * Resolve the @types/bun version to use for the target Bun version.
 *
 * If an exact matching @types/bun version is not published yet, fall back to
 * the newest semver-compatible published version.
 */
async function resolveTypesBunVersion(targetVersion: string): Promise<string> {
  const response = await fetch("https://registry.npmjs.org/@types%2fbun");
  if (!response.ok) {
    throw new Error(`Failed to fetch @types/bun metadata: ${response.status}`);
  }

  const data = (await response.json()) as {
    readonly versions?: Record<string, unknown>;
    readonly "dist-tags"?: {
      readonly latest?: string;
    };
  };

  if (data.versions && Object.hasOwn(data.versions, targetVersion)) {
    return targetVersion;
  }

  if (data.versions) {
    const compatible = Object.keys(data.versions)
      .filter((candidate) =>
        isTypesBunVersionCompatible(targetVersion, candidate)
      )
      .map((candidate) => ({
        version: candidate,
        parsed: parseSemver(candidate),
      }))
      .filter(
        (
          candidate
        ): candidate is {
          readonly parsed: ParsedSemver;
          readonly version: string;
        } => !!candidate.parsed
      )
      .toSorted((left, right) => right.parsed.patch - left.parsed.patch);

    const preferred = compatible[0];
    if (preferred) {
      return preferred.version;
    }
  }

  const latest = data["dist-tags"]?.latest;
  if (latest && isTypesBunVersionCompatible(targetVersion, latest)) {
    return latest;
  }

  return targetVersion;
}

/**
 * Find all package.json files (excluding node_modules) from disk.
 *
 * Uses filesystem globbing as the source of truth and supplements results
 * with Git-tracked/untracked paths when available.
 */
function findPackageJsonFiles(dir: string): string[] {
  const files = new Set<string>();
  const glob = new Bun.Glob("**/package.json");

  for (const path of glob.scanSync({ cwd: dir })) {
    if (!path.includes("node_modules")) {
      files.add(join(dir, path));
    }
  }

  const gitList = Bun.spawnSync(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: dir }
  );
  if (gitList.exitCode === 0) {
    const trackedAndUntrackedFiles = new TextDecoder()
      .decode(gitList.stdout)
      .split("\n")
      .filter((path) => path.endsWith("package.json"))
      .filter((path) => !path.includes("node_modules"))
      .map((path) => join(dir, path))
      .filter((path) => existsSync(path));

    for (const filePath of trackedAndUntrackedFiles) {
      files.add(filePath);
    }
  }

  return [...files].toSorted();
}

/**
 * Update packageManager in a package.json file
 */
function updatePackageManager(filePath: string, version: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const pattern = /"packageManager":\s*"bun@[\d.]+"/;

  if (!pattern.test(content)) {
    return false;
  }

  const updated = content.replace(
    pattern,
    `"packageManager": "bun@${version}"`
  );
  if (updated !== content) {
    writeFileSync(filePath, updated);
    return true;
  }
  return false;
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
  options: UpgradeBunOptions = {}
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

  let typesVersion = version;
  try {
    info("Resolving @types/bun version...");
    typesVersion = await resolveTypesBunVersion(version);
    if (typesVersion !== version) {
      warn(
        `@types/bun ${version} is not published yet; using @types/bun ${typesVersion}`
      );
    }
  } catch (error) {
    warn(
      `Could not resolve @types/bun metadata (${error instanceof Error ? error.message : "unknown error"}), defaulting to ${version}`
    );
  }

  // Update .bun-version
  writeFileSync(bunVersionFile, `${version}\n`);
  success("Updated .bun-version");

  // Find and update package.json files
  const packageFiles = findPackageJsonFiles(cwd);

  info("Updating packageManager...");
  for (const file of packageFiles) {
    if (updatePackageManager(file, version)) {
      log(`  ${file.replace(`${cwd}/`, "")}`);
    }
  }

  info("Updating engines.bun...");
  for (const file of packageFiles) {
    if (updateEnginesBun(file, version)) {
      log(`  ${file.replace(`${cwd}/`, "")}`);
    }
  }

  info("Updating @types/bun...");
  for (const file of packageFiles) {
    if (updateTypesBun(file, typesVersion)) {
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
  log("  - package.json files (packageManager, engines.bun, @types/bun)");
  log("  - bun.lock");
  log("");
  log(
    `Commit with: git add -A && git commit -m 'chore: upgrade Bun to ${version}'`
  );
}
