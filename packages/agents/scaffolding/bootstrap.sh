#!/usr/bin/env bash
#
# bootstrap.sh — Thin shim to ensure Bun, then hand off to TypeScript
#
# Usage: ./scripts/bootstrap.sh [--force]
#

set -euo pipefail

# Ensure Bun is installed
if ! command -v bun &>/dev/null; then
  echo "▸ Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  echo "✓ Bun installed"
fi

# Determine project root
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  PROJECT_DIR="$CLAUDE_PROJECT_DIR"
else
  PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

# Hand off to TypeScript bootstrap
if [[ -f "$PROJECT_DIR/scripts/bootstrap.ts" ]]; then
  exec bun run "$PROJECT_DIR/scripts/bootstrap.ts" "$@"
else
  echo "No scripts/bootstrap.ts found. Running default bootstrap..."
  exec bun -e "import { bootstrap } from '@outfitter/agents/bootstrap'; await bootstrap();"
fi
