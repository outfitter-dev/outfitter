#!/usr/bin/env bun

/**
 * Check if outfitter marketplaces are configured in project or user settings
 * Usage: bun check-outfitter.ts [project-root]
 */

import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const PROJECT_SETTINGS = join(ROOT, ".claude/settings.json");
const USER_SETTINGS = join(homedir(), ".claude/settings.json");

interface Settings {
  extraKnownMarketplaces?: Record<
    string,
    { source: { source: string; repo: string } }
  >;
  enabledPlugins?: Record<string, boolean>;
}

interface MarketplaceConfig {
  alias: string;
  repo: string;
  requiredPlugin: string;
  label: string;
}

const MARKETPLACES: MarketplaceConfig[] = [
  {
    alias: "outfitter",
    repo: "outfitter-dev/outfitter",
    requiredPlugin: "outfitter@outfitter",
    label: "outfitter (core)",
  },
];

const OPTIONAL_PLUGINS = ["gt@outfitter", "but@outfitter", "cli-dev@outfitter"];

async function loadSettings(path: string): Promise<Settings | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return file.json();
}

function checkMarketplace(
  settings: Settings | null,
  config: MarketplaceConfig
): boolean {
  return (
    settings?.extraKnownMarketplaces?.[config.alias]?.source?.repo ===
    config.repo
  );
}

function checkPlugin(settings: Settings | null, plugin: string): boolean {
  return settings?.enabledPlugins?.[plugin] === true;
}

function location(project: boolean, user: boolean): string {
  if (project && user) return "both";
  if (user) return "user";
  if (project) return "project";
  return "none";
}

async function main() {
  const projectSettings = await loadSettings(PROJECT_SETTINGS);
  const userSettings = await loadSettings(USER_SETTINGS);

  let allConfigured = true;
  const issues: string[] = [];

  console.log("Outfitter Setup Check");
  console.log("=====================");
  console.log("");

  // Check each marketplace and its required plugin
  for (const mp of MARKETPLACES) {
    const projectHasMp = checkMarketplace(projectSettings, mp);
    const userHasMp = checkMarketplace(userSettings, mp);
    const hasMp = projectHasMp || userHasMp;

    const projectHasPlugin = checkPlugin(projectSettings, mp.requiredPlugin);
    const userHasPlugin = checkPlugin(userSettings, mp.requiredPlugin);
    const hasPlugin = projectHasPlugin || userHasPlugin;

    console.log(`${mp.label}:`);
    if (hasMp) {
      console.log(`  Marketplace: ✓ (${location(projectHasMp, userHasMp)})`);
    } else {
      console.log("  Marketplace: ✗ missing");
      issues.push(`Add ${mp.alias} marketplace (${mp.repo})`);
      allConfigured = false;
    }

    if (hasPlugin) {
      console.log(`  Plugin: ✓ (${location(projectHasPlugin, userHasPlugin)})`);
    } else {
      console.log("  Plugin: ✗ missing");
      issues.push(`Enable ${mp.requiredPlugin}`);
      allConfigured = false;
    }
    console.log("");
  }

  // Check optional plugins
  const enabledOptional = OPTIONAL_PLUGINS.filter(
    (p) => checkPlugin(projectSettings, p) || checkPlugin(userSettings, p)
  ).map((p) => p.split("@")[0]);

  if (enabledOptional.length > 0) {
    console.log(`Optional: ${enabledOptional.join(", ")}`);
    console.log("");
  }

  // Summary
  if (allConfigured) {
    console.log("Status: CONFIGURED");
  } else {
    console.log("Status: INCOMPLETE");
    console.log("");
    console.log("Issues:");
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
    console.log("");
    printRecommendation();
  }
}

function printRecommendation() {
  console.log("Required .claude/settings.json:");
  console.log("");
  console.log(`{
  "extraKnownMarketplaces": {
    "outfitter": {
      "source": { "source": "github", "repo": "outfitter-dev/outfitter" }
    }
  },
  "enabledPlugins": {
    "outfitter@outfitter": true
  }
}`);
  console.log("");
  console.log("Optional: gt@outfitter, but@outfitter, cli-dev@outfitter");
}

main().catch(console.error);
