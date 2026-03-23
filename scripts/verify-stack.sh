#!/usr/bin/env bash
# Pre-submit verification for stacked branch workflows.
#
# Regenerates the surface lock, checks for uncommitted drift, then runs
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

# Step 1: Regenerate surface lock
# Build step is unnecessary — Bun transpiles TypeScript on the fly, so
# `schema generate` always reflects the current source without a prior build.
log "1/3 ${BLUE}Regenerating surface lock${NC}"
bun run apps/outfitter/src/cli.ts schema generate

# Step 2: Check for uncommitted surface lock changes
# Compare against HEAD (not the index) so staged-but-uncommitted drift is
# also caught. This prevents the scenario where `git add` + rerun falsely
# reports the lock as up to date while HEAD still has the stale version.
log ""
log "2/3 ${BLUE}Checking surface lock freshness${NC}"
if ! git diff --quiet HEAD -- .outfitter/surface.lock; then
  log ""
  log "${RED}Surface lock changed after regeneration.${NC}"
  log "The committed .outfitter/surface.lock is stale."
  log ""
  log "Fix:"
  log "  git add .outfitter/surface.lock"
  log "  git commit -m \"chore: regenerate surface lock\""
  log "  bun run verify:stack"
  exit 1
fi

if git ls-files --others --exclude-standard -- .outfitter/surface.lock | grep -q .; then
  log ""
  log "${RED}Surface lock is untracked.${NC}"
  log ""
  log "Fix:"
  log "  git add .outfitter/surface.lock"
  log "  git commit -m \"chore: add surface lock\""
  log "  bun run verify:stack"
  exit 1
fi

log "  Surface lock is up to date."

# Step 3: Run pre-push verification
log ""
log "3/3 ${BLUE}Running pre-push verification${NC}"
bun run apps/outfitter/src/cli.ts check --pre-push

log ""
log "${GREEN}verify:stack passed${NC} — safe to submit"
