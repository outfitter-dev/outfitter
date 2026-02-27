#!/usr/bin/env bash
#
# agent-maintenance.sh — Refresh a cached agent container after branch checkout
#
# Lighter than agent-setup.sh: assumes the container was previously set up and
# cached. Ensures Bun is still at the pinned version (branch may have bumped),
# reinstalls deps, and rebuilds.
#
# Usage: ./scripts/agent-maintenance.sh
#
# Called from the provider's "maintenance script" slot, which runs on cached
# containers after checking out the new branch.
#

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

BUN_VERSION_FILE="$REPO_ROOT/.bun-version"
if [[ ! -f "$BUN_VERSION_FILE" ]]; then
  echo "Error: Missing .bun-version" >&2
  exit 1
fi

PINNED_BUN="$(tr -d '[:space:]' < "$BUN_VERSION_FILE")"
if [[ -z "$PINNED_BUN" ]]; then
  echo "Error: .bun-version is empty" >&2
  exit 1
fi

# ── Ensure PATH ──────────────────────────────────────────────────────
# The cached container should already have ~/.agent-env.sh from the
# initial setup, but source it explicitly in case this shell missed it.
ENV_FILE="${HOME}/.agent-env.sh"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  . "$ENV_FILE"
else
  # Fallback: env file missing from cache — set PATH directly
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
fi

# ── Bun version check ───────────────────────────────────────────────
CURRENT_BUN="$(bun --version 2>/dev/null || echo "none")"

if [[ "$CURRENT_BUN" != "$PINNED_BUN" ]]; then
  echo "Upgrading Bun from ${CURRENT_BUN} to ${PINNED_BUN}..."
  curl -fsSL https://bun.sh/install | bash -s -- "bun-v${PINNED_BUN}"
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
  hash -r

  INSTALLED_BUN="$(bun --version)"
  if [[ "$INSTALLED_BUN" != "$PINNED_BUN" ]]; then
    echo "Error: Expected Bun ${PINNED_BUN} but found ${INSTALLED_BUN} after install" >&2
    exit 1
  fi
else
  echo "Bun: ${CURRENT_BUN} (up to date)"
fi

# ── Ensure env file exists ───────────────────────────────────────────
# Always recreate the env file. In cached containers it may have been
# removed or never created, even though ~/.bun has the right version.
cat > "$ENV_FILE" <<'ENVEOF'
export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"
ENVEOF

# ── Dependencies ─────────────────────────────────────────────────────
echo "Installing dependencies..."
(cd "$REPO_ROOT" && bun install)

# ── Build ────────────────────────────────────────────────────────────
echo "Building workspace packages..."
(cd "$REPO_ROOT" && bun run build)

echo "Agent environment refreshed."
