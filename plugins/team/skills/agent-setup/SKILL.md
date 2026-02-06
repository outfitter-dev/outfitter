---
name: agent-setup
description: Check and configure outfitter marketplaces and plugins. Use when setting up a new project, checking plugin configuration, or when "setup outfitter", "configure plugins", or "marketplace" are mentioned.
---

# Agent Setup

Check and configure outfitter marketplaces in a project.

## Check Current Status

Checks both project (`.claude/settings.json`) and user (`~/.claude/settings.json`) levels.

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/agent-setup/scripts/check-outfitter.ts .`

## Marketplaces

| Alias | Repo | Required Plugin |
|-------|------|-----------------|
| `outfitter` | `outfitter-dev/outfitter` | `outfitter@outfitter` |

## Optional Plugins

From `outfitter` marketplace:

| Plugin | Purpose |
|--------|---------|
| `gt` | Graphite stacked PR workflows |
| `but` | GitButler virtual branch workflows |
| `cli-dev` | CLI development patterns |

## Required Setup

```json
{
  "extraKnownMarketplaces": {
    "outfitter": {
      "source": { "source": "github", "repo": "outfitter-dev/outfitter" }
    }
  },
  "enabledPlugins": {
    "outfitter@outfitter": true
  }
}
```

## Full Setup

```json
{
  "extraKnownMarketplaces": {
    "outfitter": {
      "source": { "source": "github", "repo": "outfitter-dev/outfitter" }
    }
  },
  "enabledPlugins": {
    "outfitter@outfitter": true,
    "gt@outfitter": true,
    "but@outfitter": true,
    "cli-dev@outfitter": true
  }
}
```
