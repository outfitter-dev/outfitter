#!/usr/bin/env bash
#
# outfitter-init setup script
#
# Scans a codebase and generates an Outfitter Stack adoption plan.
# Will NOT override an existing .agents/ directory.
#
# Usage:
#   ./setup.sh [project-root]
#
# If project-root is not provided, uses current directory.

set -euo pipefail

# Colors (disabled if not TTY)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Get project root (default: current directory)
PROJECT_ROOT="${1:-$(pwd)}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)" # Resolve to absolute path

AGENTS_DIR="$PROJECT_ROOT/.agents"
OUTPUT_DIR="$AGENTS_DIR/plans/outfitter-init"

echo -e "${BLUE}Outfitter Init${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .agents/ already exists
if [[ -d "$AGENTS_DIR" ]]; then
  echo -e "${YELLOW}Warning:${NC} .agents/ directory already exists at:"
  echo "  $AGENTS_DIR"
  echo ""

  if [[ -d "$OUTPUT_DIR" ]]; then
    echo -e "${RED}Error:${NC} outfitter-init plan already exists at:"
    echo "  $OUTPUT_DIR"
    echo ""
    echo "To regenerate, first remove the existing plan:"
    echo "  rm -rf \"$OUTPUT_DIR\""
    exit 1
  fi

  echo "Continuing with existing .agents/ directory..."
  echo ""
fi

# Check for bun
if ! command -v bun &> /dev/null; then
  echo -e "${RED}Error:${NC} bun is required but not installed."
  echo "Install from: https://bun.sh"
  exit 1
fi

# Check for ripgrep
if ! command -v rg &> /dev/null; then
  echo -e "${RED}Error:${NC} ripgrep (rg) is required but not installed."
  echo "Install with: brew install ripgrep"
  exit 1
fi

# Find the scan.ts script (relative to this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAN_SCRIPT="$SCRIPT_DIR/scan.ts"

if [[ ! -f "$SCAN_SCRIPT" ]]; then
  echo -e "${RED}Error:${NC} scan.ts not found at:"
  echo "  $SCAN_SCRIPT"
  exit 1
fi

# Run the scanner
echo -e "${BLUE}Scanning:${NC} $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"
bun run "$SCAN_SCRIPT" "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Plan created at: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Load the fieldguide:  /kit:outfitter-fieldguide"
echo "  2. Review the plan:      $OUTPUT_DIR/PLAN.md"
echo "  3. Check scope:          $OUTPUT_DIR/SCAN.md"
echo "  4. Start with:           $OUTPUT_DIR/stages/foundation.md"
