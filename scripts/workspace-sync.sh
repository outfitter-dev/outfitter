#!/usr/bin/env bash
# workspace-sync.sh
# Sync workspace files (scaffolding, marketplace, docs). Explicit invocation only.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# -----------------------------------------------------------------------------
# Sync agent scaffolding
# -----------------------------------------------------------------------------
# Keeps .claude/ settings and hooks in sync with packages/agents/scaffolding/

sync_agent_scaffolding() {
  local src="$ROOT_DIR/.claude"
  local dest="$ROOT_DIR/packages/agents/scaffolding/.claude"

  # Ensure destination exists
  mkdir -p "$dest/hooks"

  # Sync settings.json
  if [[ -f "$src/settings.json" ]]; then
    cp "$src/settings.json" "$dest/"
    echo "[workspace-sync] Synced .claude/settings.json"
  fi

  # Sync hooks directory
  if [[ -d "$src/hooks" ]]; then
    cp -r "$src/hooks" "$dest/"
    echo "[workspace-sync] Synced .claude/hooks/"
  fi
}

# -----------------------------------------------------------------------------
# Generate marketplace manifest
# -----------------------------------------------------------------------------
# Produces a JSON artifact from .claude-plugin/marketplace.json so the
# agent-setup skill can read it at runtime without monorepo access.

generate_marketplace_manifest() {
  bun "$SCRIPT_DIR/generate-marketplace-manifest.ts"
}

# -----------------------------------------------------------------------------
# Assemble package docs
# -----------------------------------------------------------------------------
# Uses canonical repo command surface with source-first module resolution.

assemble_package_docs() {
  (
    cd "$ROOT_DIR"
    bun run apps/outfitter/src/cli.ts repo sync docs --cwd "$ROOT_DIR"
  )
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  echo "[workspace-sync] Starting..."

  sync_agent_scaffolding
  generate_marketplace_manifest
  assemble_package_docs

  echo "[workspace-sync] Done"
}

main "$@"
