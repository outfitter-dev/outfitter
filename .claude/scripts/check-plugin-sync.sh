#!/usr/bin/env bash
# Reminds to sync outfitter-dev/agents marketplace.json when plugin.json changes

if echo "$CLAUDE_TOOL_INPUT" | grep -q 'packages/claude-plugin/.claude-plugin/plugin.json'; then
	echo '⚠️  plugin.json updated — remember to sync version/ref in outfitter-dev/agents marketplace.json'
fi
