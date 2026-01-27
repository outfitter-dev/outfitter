#!/usr/bin/env bash
# Upgrade Bun version across the project
#
# Usage:
#   ./scripts/upgrade-bun.sh 1.4.0        # Upgrade to specific version
#   ./scripts/upgrade-bun.sh              # Upgrade to latest

set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Fetching latest Bun version..."
  VERSION=$(curl -s https://api.github.com/repos/oven-sh/bun/releases/latest | grep '"tag_name"' | sed -E 's/.*"bun-v([^"]+)".*/\1/')
  echo "Latest version: $VERSION"
fi

CURRENT=$(cat .bun-version 2>/dev/null || echo "unknown")
echo "Current version: $CURRENT"

if [[ "$CURRENT" == "$VERSION" ]]; then
  echo "Already on version $VERSION"
  exit 0
fi

echo ""
echo "Upgrading Bun: $CURRENT -> $VERSION"
echo ""

# Update version file
echo "$VERSION" > .bun-version

# Install new version locally (if bun is available)
if command -v bun &> /dev/null; then
  echo "Installing Bun $VERSION locally..."
  curl -fsSL https://bun.sh/install | bash -s "bun-v$VERSION"

  # Reload shell to pick up new version
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  echo ""
  echo "Updating lockfile..."
  bun install

  echo ""
  echo "Done! Changes ready to commit:"
  echo "  - .bun-version"
  echo "  - bun.lock"
  echo ""
  echo "Commit with:"
  echo "  git add .bun-version bun.lock && git commit -m 'chore: upgrade Bun to $VERSION'"
else
  echo "Bun not found. Install manually, then run 'bun install' to update lockfile."
fi
