#!/usr/bin/env bash
#
# agent-setup.sh — Minimal environment setup for AI agent sandboxes
#
# Installs the pinned Bun version, project dependencies, and builds
# workspace packages. Does NOT install developer tools (gh, gt, etc.)
# or require sudo/apt. Safe for restricted cloud containers.
#
# Usage: ./scripts/agent-setup.sh
#
# Called by provider-specific configs:
#   - Codex:  .codex/environments/environment.toml
#   - Devin:  devin.json
#   - etc.
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

# ── Bun ──────────────────────────────────────────────────────────────
export BUN_INSTALL="${HOME}/.bun"
export PATH="${BUN_INSTALL}/bin:${PATH}"

CURRENT_BUN="$(bun --version 2>/dev/null || echo "none")"

if [[ "$CURRENT_BUN" != "$PINNED_BUN" ]]; then
  echo "Installing Bun ${PINNED_BUN} (container has ${CURRENT_BUN})..."
  curl -fsSL https://bun.sh/install | bash -s -- "bun-v${PINNED_BUN}"
  # Re-export after install
  export PATH="${BUN_INSTALL}/bin:${PATH}"
  hash -r
fi

echo "Bun: $(bun --version)"

# ── Persist PATH for agent phase ─────────────────────────────────────
# Cloud agent environments run setup and agent in separate shell sessions.
# Exports here don't carry over — write to .bashrc so the agent gets them.
if ! grep -q 'BUN_INSTALL' ~/.bashrc 2>/dev/null; then
  {
    echo ''
    echo '# Added by agent-setup.sh'
    echo 'export BUN_INSTALL="${HOME}/.bun"'
    echo 'export PATH="${BUN_INSTALL}/bin:${PATH}"'
  } >> ~/.bashrc
fi

# ── Dependencies ─────────────────────────────────────────────────────
echo "Installing dependencies..."
(cd "$REPO_ROOT" && bun install)

# ── Build ────────────────────────────────────────────────────────────
# Turbo builds packages in dependency order (dependsOn: [^build]).
# Populates dist/ so workspace module resolution works.
echo "Building workspace packages..."
(cd "$REPO_ROOT" && bun run build)

echo "Agent environment ready."
