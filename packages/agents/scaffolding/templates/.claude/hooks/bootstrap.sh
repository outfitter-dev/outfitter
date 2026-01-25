#!/usr/bin/env bash
#
# bootstrap.sh — Ensure environment is ready for development
#
# Called by SessionStart hook. Fast-path exits if all deps present.
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
  PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
fi

# Hand off to TypeScript bootstrap if available
if [[ -f "$PROJECT_DIR/scripts/bootstrap.ts" ]]; then
  exec bun run "$PROJECT_DIR/scripts/bootstrap.ts" "$@"
fi

# Otherwise, minimal bootstrap: just ensure deps
if [[ -d "$PROJECT_DIR/node_modules" ]]; then
  exit 0  # All good
fi

echo "▸ Installing dependencies..."
cd "$PROJECT_DIR" && bun install
echo "✓ Dependencies installed"
