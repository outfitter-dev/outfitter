#!/usr/bin/env bash
# Pre-submit verification for stacked branch workflows.
#
# Regenerates the surface map, checks for uncommitted drift, then runs
# the full pre-push verification gate. Run this before `gt submit` or
# `gt stack submit` to catch schema drift locally.
#
# Usage:
#   bun run verify:stack
#
# See: docs/ci-cd/stacked-pr-workflow.md

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { printf '%b\n' "$1"; }

log "${BLUE}verify:stack${NC} — pre-submit check for stacked branches"
echo ""

# Step 1: Regenerate surface map
log "1/3 ${BLUE}Regenerating surface map${NC}"
bun run apps/outfitter/src/cli.ts schema generate

# Step 2: Check for uncommitted surface map changes
log ""
log "2/3 ${BLUE}Checking surface map freshness${NC}"
if ! git diff --quiet -- .outfitter/surface.json; then
  log ""
  log "${RED}Surface map changed after regeneration.${NC}"
  log "The committed .outfitter/surface.json is stale."
  log ""
  log "Fix:"
  log "  git add .outfitter/surface.json"
  log "  git commit -m \"chore: regenerate surface map\""
  log "  bun run verify:stack"
  exit 1
fi

if git ls-files --others --exclude-standard -- .outfitter/surface.json | grep -q .; then
  log ""
  log "${RED}Surface map is untracked.${NC}"
  log ""
  log "Fix:"
  log "  git add .outfitter/surface.json"
  log "  git commit -m \"chore: add surface map\""
  log "  bun run verify:stack"
  exit 1
fi

log "  Surface map is up to date."

# Step 3: Run pre-push verification
log ""
log "3/3 ${BLUE}Running pre-push verification${NC}"
bun run apps/outfitter/src/cli.ts check --pre-push

log ""
log "${GREEN}verify:stack passed${NC} — safe to submit"
