#!/usr/bin/env bun
/**
 * Syncs plugin package.json versions to their plugin.json files after `changeset version` runs.
 *
 * - Reads each plugin's package.json version
 * - Updates corresponding .claude-plugin/plugin.json version
 * - Updates marketplace.json metadata.version to match highest plugin version
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dirname
  ? join(import.meta.dirname, "..")
  : process.cwd();
const PLUGINS_DIR = join(ROOT, "plugins");
const MARKETPLACE_PATH = join(ROOT, ".claude-plugin/marketplace.json");

// Plugins tracked by changesets (directory names)
const PLUGINS = ["outfitter", "kit", "team"];

interface PluginJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface Marketplace {
  metadata: { version: string; [key: string]: unknown };
  plugins: Array<{ name: string; source: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`);
}

/**
 * Compare semver versions. Returns:
 * - positive if a > b
 * - negative if a < b
 * - 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(".").map(Number);
  const [aMajor = 0, aMinor = 0, aPatch = 0] = parse(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parse(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

function main() {
  let highestVersion = "0.0.0";
  let updated = 0;

  for (const pluginDir of PLUGINS) {
    const pkgPath = join(PLUGINS_DIR, pluginDir, "package.json");
    const pluginJsonPath = join(
      PLUGINS_DIR,
      pluginDir,
      ".claude-plugin/plugin.json"
    );

    // Read package.json version (source of truth from changesets)
    if (!existsSync(pkgPath)) {
      console.warn(`⚠ Skipping ${pluginDir}: no package.json found`);
      continue;
    }

    const pkg = readJson<{ version: string }>(pkgPath);
    const version = pkg.version;

    if (!version) {
      console.warn(`⚠ Skipping ${pluginDir}: no version in package.json`);
      continue;
    }

    // Update plugin.json if it exists
    if (existsSync(pluginJsonPath)) {
      const pluginJson = readJson<PluginJson>(pluginJsonPath);
      const oldVersion = pluginJson.version;

      if (oldVersion !== version) {
        pluginJson.version = version;
        writeJson(pluginJsonPath, pluginJson);
        console.log(`✓ ${pluginDir}: ${oldVersion} → ${version}`);
        updated++;
      }
    }

    // Track highest version for marketplace metadata
    if (compareVersions(version, highestVersion) > 0) {
      highestVersion = version;
    }
  }

  // Update marketplace.json metadata.version
  if (existsSync(MARKETPLACE_PATH)) {
    const marketplace = readJson<Marketplace>(MARKETPLACE_PATH);
    const oldMetaVersion = marketplace.metadata.version;

    if (oldMetaVersion !== highestVersion) {
      marketplace.metadata.version = highestVersion;
      writeJson(MARKETPLACE_PATH, marketplace);
      console.log(
        `✓ marketplace metadata.version: ${oldMetaVersion} → ${highestVersion}`
      );
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`\n✓ Synced ${updated} file(s)`);
  } else {
    console.log("✓ All plugin versions already in sync");
  }
}

main();
