#!/usr/bin/env bun

/**
 * Sync GitHub labels from canonical labels.yml
 *
 * Usage:
 *   bun .github/scripts/sync-labels.ts [options]
 *
 * Options:
 *   --dry-run     Show what would change without making changes
 *   --delete      Delete labels not in labels.yml (use with caution)
 *   --repo        Override repo (default: from git remote)
 *
 * Environment:
 *   GITHUB_TOKEN or GH_TOKEN must be set (or use gh auth)
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { $ } from "bun";
import { parse } from "yaml";

interface LabelDef {
  aliases?: string[];
  color: string;
  description: string;
  name: string;
}

interface GitHubLabel {
  color: string;
  description: string | null;
  name: string;
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteUnknown = args.includes("--delete");
const repoIndex = args.indexOf("--repo");
const repoOverride = repoIndex !== -1 ? args[repoIndex + 1] : null;

// Colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function getRepo(): Promise<string> {
  if (repoOverride) return repoOverride;

  const result = await $`gh repo view --json nameWithOwner -q .nameWithOwner`
    .text()
    .catch(() => null);

  if (!result) {
    console.error(red("Could not determine repo. Use --repo owner/name"));
    process.exit(1);
  }

  return result.trim();
}

async function getExistingLabels(repo: string): Promise<GitHubLabel[]> {
  const result =
    await $`gh label list --repo ${repo} --json name,color,description --limit 500`.json();
  return result as GitHubLabel[];
}

function loadLabelDefs(): LabelDef[] {
  // Find labels.yml relative to this script
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const labelsPath = resolve(scriptDir, "..", "labels.yml");

  if (!existsSync(labelsPath)) {
    console.error(red(`labels.yml not found at ${labelsPath}`));
    process.exit(1);
  }

  const content = readFileSync(labelsPath, "utf-8");
  return parse(content) as LabelDef[];
}

async function createLabel(repo: string, label: LabelDef): Promise<void> {
  if (dryRun) {
    console.log(green(`+ CREATE: ${label.name}`), dim(`(${label.color})`));
    return;
  }

  await $`gh label create ${label.name} --repo ${repo} --color ${label.color} --description ${label.description} --force`;
  console.log(green(`+ Created: ${label.name}`));
}

async function updateLabel(
  repo: string,
  label: LabelDef,
  existing: GitHubLabel
): Promise<void> {
  const colorChanged =
    existing.color.toLowerCase() !== label.color.toLowerCase();
  const descChanged = (existing.description || "") !== label.description;

  if (!(colorChanged || descChanged)) return;

  if (dryRun) {
    const changes: string[] = [];
    if (colorChanged) changes.push(`color: ${existing.color} → ${label.color}`);
    if (descChanged) changes.push("description changed");
    console.log(
      yellow(`~ UPDATE: ${label.name}`),
      dim(`(${changes.join(", ")})`)
    );
    return;
  }

  await $`gh label edit ${label.name} --repo ${repo} --color ${label.color} --description ${label.description}`;
  console.log(yellow(`~ Updated: ${label.name}`));
}

async function renameLabel(
  repo: string,
  oldName: string,
  newName: string,
  label: LabelDef
): Promise<void> {
  if (dryRun) {
    console.log(
      yellow(`→ RENAME: ${oldName} → ${newName}`),
      dim("(migration)")
    );
    return;
  }

  await $`gh label edit ${oldName} --repo ${repo} --name ${newName} --color ${label.color} --description ${label.description}`;
  console.log(yellow(`→ Renamed: ${oldName} → ${newName}`));
}

async function deleteLabel(repo: string, name: string): Promise<void> {
  if (dryRun) {
    console.log(red(`- DELETE: ${name}`));
    return;
  }

  await $`gh label delete ${name} --repo ${repo} --yes`;
  console.log(red(`- Deleted: ${name}`));
}

async function main() {
  console.log(dim("Outfitter Label Sync"));
  console.log(dim("====================\n"));

  if (dryRun) {
    console.log(yellow("DRY RUN - no changes will be made\n"));
  }

  const repo = await getRepo();
  console.log(dim(`Repository: ${repo}\n`));

  const labelDefs = loadLabelDefs();
  const existing = await getExistingLabels(repo);

  const existingByName = new Map(
    existing.map((l) => [l.name.toLowerCase(), l])
  );
  const canonicalNames = new Set(labelDefs.map((l) => l.name.toLowerCase()));

  // Build alias map: oldName -> newLabel
  const aliasMap = new Map<string, LabelDef>();
  for (const label of labelDefs) {
    if (label.aliases) {
      for (const alias of label.aliases) {
        aliasMap.set(alias.toLowerCase(), label);
      }
    }
  }

  let created = 0;
  let updated = 0;
  let renamed = 0;
  let deleted = 0;

  // Process migrations (renames/deletes) first
  for (const [alias, label] of aliasMap) {
    const existingAlias = existingByName.get(alias);
    if (existingAlias) {
      const targetExists = existingByName.has(label.name.toLowerCase());
      if (targetExists) {
        // Target already exists - delete the alias instead of renaming
        if (dryRun) {
          console.log(
            red(`- DELETE: ${existingAlias.name}`),
            dim(`(alias for existing ${label.name})`)
          );
        } else {
          await $`gh label delete ${existingAlias.name} --repo ${repo} --yes`;
          console.log(
            red(`- Deleted: ${existingAlias.name}`),
            dim(`(alias for existing ${label.name})`)
          );
        }
        deleted++;
      } else {
        // Target doesn't exist - rename
        await renameLabel(repo, existingAlias.name, label.name, label);
        existingByName.set(label.name.toLowerCase(), {
          name: label.name,
          color: label.color,
          description: label.description,
        });
        renamed++;
      }
      existingByName.delete(alias);
    }
  }

  // Create or update canonical labels
  for (const label of labelDefs) {
    const existingLabel = existingByName.get(label.name.toLowerCase());

    if (existingLabel) {
      await updateLabel(repo, label, existingLabel);
      const colorChanged =
        existingLabel.color.toLowerCase() !== label.color.toLowerCase();
      const descChanged =
        (existingLabel.description || "") !== label.description;
      if (colorChanged || descChanged) updated++;
    } else {
      await createLabel(repo, label);
      created++;
    }
  }

  // Delete unknown labels (if --delete flag)
  if (deleteUnknown) {
    for (const [name, label] of existingByName) {
      if (!(canonicalNames.has(name) || aliasMap.has(name))) {
        await deleteLabel(repo, label.name);
        deleted++;
      }
    }
  }

  // Summary
  console.log(dim("\n--------------------"));
  console.log(
    `${dryRun ? "Would make" : "Made"} changes: ` +
      `${green(`${created} created`)}, ` +
      `${yellow(`${updated} updated`)}, ` +
      `${yellow(`${renamed} renamed`)}, ` +
      `${red(`${deleted} deleted`)}`
  );

  if (!deleteUnknown) {
    const unknownCount = [...existingByName.keys()].filter(
      (n) => !(canonicalNames.has(n) || aliasMap.has(n))
    ).length;
    if (unknownCount > 0) {
      console.log(
        dim(
          `\n${unknownCount} labels not in labels.yml (use --delete to remove)`
        )
      );
    }
  }
}

main().catch((err) => {
  console.error(red(`Error: ${err.message}`));
  process.exit(1);
});
