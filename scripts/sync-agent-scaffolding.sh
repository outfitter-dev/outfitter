#!/usr/bin/env bash
# sync-agent-scaffolding.sh
# Keeps .claude/ settings and hooks in sync with packages/agents/scaffolding/.
# Narrow scope — only copies settings.json and hooks. No marketplace or docs mutation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

src="$ROOT_DIR/.claude"
dest="$ROOT_DIR/packages/agents/scaffolding/.claude"

mkdir -p "$dest/hooks"

if [[ -f "$src/settings.json" ]]; then
  cp "$src/settings.json" "$dest/"
fi

if [[ -d "$src/hooks" ]]; then
  cp -r "$src/hooks" "$dest/"
fi
