#!/usr/bin/env bun

/**
 * Generate marketplace-manifest.json from .claude-plugin/marketplace.json.
 *
 * This runs at prebuild time so the check-outfitter skill can read
 * the manifest at runtime without access to the monorepo source tree.
 */

import { dirname, join } from "node:path";

const ROOT = dirname(dirname(new URL(import.meta.url).pathname));
const SOURCE = join(ROOT, ".claude-plugin/marketplace.json");
const DEST = join(
  ROOT,
  "plugins/team/skills/outfitter-agents-check/marketplace-manifest.json"
);

interface MarketplaceJson {
  name: string;
  repository: string;
  plugins: { name: string; source: string }[];
}

function deriveRepo(repositoryUrl: string): string {
  // "https://github.com/outfitter-dev/outfitter" → "outfitter-dev/outfitter"
  const cleaned = repositoryUrl.replace(/\/+$/, "");
  const match = cleaned.match(/github\.com\/(.+?)(?:\.git)?$/);
  if (!match?.[1]) {
    throw new Error(`Cannot derive repo from repository URL: ${repositoryUrl}`);
  }
  return match[1];
}

async function main() {
  const file = Bun.file(SOURCE);
  if (!(await file.exists())) {
    throw new Error(`Source not found: ${SOURCE}`);
  }

  const marketplace: MarketplaceJson = await file.json();
  const repo = deriveRepo(marketplace.repository);

  const required = marketplace.plugins
    .filter((p) => p.name === marketplace.name)
    .map((p) => p.name);

  const optional = marketplace.plugins
    .filter((p) => p.name !== marketplace.name)
    .map((p) => p.name);

  // Build JSON manually to match Biome formatting (inline short arrays).
  const q = (s: string) => `"${s}"`;
  const arr = (items: string[]) => `[${items.map(q).join(", ")}]`;
  const json = [
    "{",
    `  "_generated": {`,
    `    "source": ".claude-plugin/marketplace.json"`,
    "  },",
    `  "marketplace": {`,
    `    "name": ${q(marketplace.name)},`,
    `    "repo": ${q(repo)},`,
    `    "source": "github"`,
    "  },",
    `  "plugins": {`,
    `    "required": ${arr(required)},`,
    `    "optional": ${arr(optional)}`,
    "  }",
    "}",
    "",
  ].join("\n");

  await Bun.write(DEST, json);
  console.log(`[generate-marketplace-manifest] Wrote ${DEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
