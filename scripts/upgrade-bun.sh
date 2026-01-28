#!/usr/bin/env bash
# Upgrade Bun version across the project
#
# Updates:
#   - .bun-version
#   - engines.bun in package.json files
#   - Pinned @types/bun versions (leaves "latest" alone)
#   - bun.lock
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

# Update .bun-version file
echo "$VERSION" > .bun-version
echo "Updated .bun-version"

# Update engines.bun in package.json files
# Matches: "bun": ">=x.y.z" and updates to new version
echo "Updating engines.bun..."
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l '"bun":.*">=' {} \; | while read -r file; do
  # macOS sed uses -i '', GNU sed uses -i
  if sed -i '' -E "s/\"bun\":[[:space:]]*\">=[0-9]+\.[0-9]+\.[0-9]+\"/\"bun\": \">=$VERSION\"/" "$file" 2>/dev/null || \
     sed -i -E "s/\"bun\":[[:space:]]*\">=[0-9]+\.[0-9]+\.[0-9]+\"/\"bun\": \">=$VERSION\"/" "$file" 2>/dev/null; then
    echo "  $file"
  fi
done

# Update pinned @types/bun versions (skip "latest")
# Matches: "@types/bun": "^x.y.z" and updates to new version
echo "Updating @types/bun..."
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l '"@types/bun".*"\^' {} \; | while read -r file; do
  if sed -i '' -E "s/\"@types\/bun\":[[:space:]]*\"\^[0-9]+\.[0-9]+\.[0-9]+\"/\"@types\/bun\": \"^$VERSION\"/" "$file" 2>/dev/null || \
     sed -i -E "s/\"@types\/bun\":[[:space:]]*\"\^[0-9]+\.[0-9]+\.[0-9]+\"/\"@types\/bun\": \"^$VERSION\"/" "$file" 2>/dev/null; then
    echo "  $file"
  fi
done

# Install new version locally (if bun is available)
if command -v bun &> /dev/null; then
  echo ""
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
  echo "  - package.json files (engines.bun, @types/bun)"
  echo "  - bun.lock"
  echo ""
  echo "Commit with:"
  echo "  git add -A && git commit -m 'chore: upgrade Bun to $VERSION'"
else
  echo ""
  echo "Bun not found. Install manually, then run 'bun install' to update lockfile."
fi
