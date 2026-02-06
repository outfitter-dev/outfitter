---
name: agent-setup
description: Check and configure outfitter marketplaces and plugins. Use when setting up a new project, checking plugin configuration, or when "setup outfitter", "configure plugins", or "marketplace" are mentioned.
---

# Agent Setup

Check and configure outfitter marketplaces in a project.

## Check Current Status

Checks both project (`.claude/settings.json`) and user (`~/.claude/settings.json`) levels.

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/agent-setup/scripts/check-outfitter.ts .`

## Settings Structure

Claude Code settings use two keys for marketplace plugins:

- **`extraKnownMarketplaces`** — registers a marketplace by alias, pointing to a GitHub repo
- **`enabledPlugins`** — enables individual plugins using `<plugin>@<marketplace>` identifiers

The check script above reports the concrete identifiers and their current status. Use its output to determine what needs to be added.
