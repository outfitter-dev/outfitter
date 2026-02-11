#!/usr/bin/env bun

/**
 * Check if outfitter marketplaces and plugins are configured.
 * Reads marketplace-manifest.json (generated at prebuild) for all values.
 *
 * Usage: bun check-outfitter.ts [project-root]
 */

import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const MANIFEST_PATH = join(SCRIPT_DIR, "../marketplace-manifest.json");

const ROOT = process.argv[2] || ".";
const PROJECT_SETTINGS = join(ROOT, ".claude/settings.json");
const USER_SETTINGS = join(homedir(), ".claude/settings.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Manifest {
  marketplace: { name: string; repo: string; source: string };
  plugins: { required: string[]; optional: string[] };
}

interface Settings {
  extraKnownMarketplaces?: Record<
    string,
    { source: { source: string; repo: string } }
  >;
  enabledPlugins?: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadJson<T>(path: string): Promise<T | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return file.json();
}

function pluginId(name: string, marketplace: string): string {
  return `${name}@${marketplace}`;
}

function location(project: boolean, user: boolean): string {
  if (project && user) return "both";
  if (user) return "user";
  if (project) return "project";
  return "none";
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function isMarketplaceRegistered(
  settings: Settings | null,
  name: string,
  repo: string
): boolean {
  return settings?.extraKnownMarketplaces?.[name]?.source?.repo === repo;
}

function isPluginEnabled(settings: Settings | null, id: string): boolean {
  return settings?.enabledPlugins?.[id] === true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const manifest = await loadJson<Manifest>(MANIFEST_PATH);
  if (!manifest) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    console.error("Run the prebuild to generate it.");
    process.exit(1);
  }

  const { marketplace, plugins } = manifest;
  const projectSettings = await loadJson<Settings>(PROJECT_SETTINGS);
  const userSettings = await loadJson<Settings>(USER_SETTINGS);

  let allConfigured = true;
  const issues: string[] = [];

  console.log("Outfitter Setup Check");
  console.log("=====================");
  console.log("");

  // --- Marketplace registration ---
  const projectHasMp = isMarketplaceRegistered(
    projectSettings,
    marketplace.name,
    marketplace.repo
  );
  const userHasMp = isMarketplaceRegistered(
    userSettings,
    marketplace.name,
    marketplace.repo
  );
  const hasMp = projectHasMp || userHasMp;

  console.log(`Marketplace "${marketplace.name}":`);
  if (hasMp) {
    console.log(`  Registered: yes (${location(projectHasMp, userHasMp)})`);
  } else {
    console.log("  Registered: no");
    issues.push(
      `Register marketplace "${marketplace.name}" (${marketplace.source}:${marketplace.repo})`
    );
    allConfigured = false;
  }
  console.log("");

  // --- Required plugins ---
  console.log("Required plugins:");
  for (const name of plugins.required) {
    const id = pluginId(name, marketplace.name);
    const inProject = isPluginEnabled(projectSettings, id);
    const inUser = isPluginEnabled(userSettings, id);
    const enabled = inProject || inUser;

    if (enabled) {
      console.log(`  ${id}: enabled (${location(inProject, inUser)})`);
    } else {
      console.log(`  ${id}: not enabled`);
      issues.push(`Enable ${id}`);
      allConfigured = false;
    }
  }
  console.log("");

  // --- Optional plugins ---
  const optionalStatuses = plugins.optional.map((name) => {
    const id = pluginId(name, marketplace.name);
    const inProject = isPluginEnabled(projectSettings, id);
    const inUser = isPluginEnabled(userSettings, id);
    return {
      id,
      enabled: inProject || inUser,
      location: location(inProject, inUser),
    };
  });

  console.log("Optional plugins:");
  for (const { id, enabled, location: loc } of optionalStatuses) {
    console.log(`  ${id}: ${enabled ? `enabled (${loc})` : "not enabled"}`);
  }
  console.log("");

  // --- Summary ---
  if (allConfigured) {
    console.log("Status: CONFIGURED");
  } else {
    console.log("Status: INCOMPLETE");
    console.log("");
    console.log("Issues:");
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  // --- Identifiers (for agents to copy/paste) ---
  console.log("");
  console.log("Identifiers:");
  console.log(
    `  Marketplace: ${marketplace.name} (${marketplace.source}:${marketplace.repo})`
  );
  const allPlugins = [...plugins.required, ...plugins.optional];
  for (const name of allPlugins) {
    const id = pluginId(name, marketplace.name);
    const isRequired = plugins.required.includes(name);
    console.log(`  Plugin: ${id}${isRequired ? " (required)" : ""}`);
  }
}

main().catch(console.error);
