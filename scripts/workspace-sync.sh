#!/usr/bin/env bash
# workspace-sync.sh
# Sync workspace files (scaffolding, marketplace, docs). Explicit invocation only.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

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

  generate_marketplace_manifest
  assemble_package_docs

  echo "[workspace-sync] Done"
}

main "$@"
