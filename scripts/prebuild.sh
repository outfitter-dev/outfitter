#!/usr/bin/env bash
# prebuild.sh
# Runs before build to sync files and prepare the workspace.

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
    echo "[prebuild] Synced .claude/settings.json"
  fi

  # Sync hooks directory
  if [[ -d "$src/hooks" ]]; then
    cp -r "$src/hooks" "$dest/"
    echo "[prebuild] Synced .claude/hooks/"
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
# Uses the docs-core package source entrypoint so prebuild can run before build.

assemble_package_docs() {
  (
    cd "$ROOT_DIR/packages/docs-core"
    bun src/cli-sync.ts --cwd "$ROOT_DIR"
  )
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  echo "[prebuild] Starting..."

  sync_agent_scaffolding
  generate_marketplace_manifest
  assemble_package_docs

  echo "[prebuild] Done"
}

main "$@"
