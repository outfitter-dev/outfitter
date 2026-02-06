#!/usr/bin/env bash
# Search existing issues on outfitter-dev/outfitter before creating duplicates
# Usage: ./search-issues.sh "search terms"

set -euo pipefail

REPO="outfitter-dev/outfitter"
QUERY="${1:-}"

if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 \"search terms\""
  echo ""
  echo "Examples:"
  echo "  $0 \"Result unwrap\"        # Search for Result.unwrap issues"
  echo "  $0 \"validation error\"     # Search for validation error issues"
  echo "  $0 \"cli output\"           # Search for CLI output issues"
  exit 1
fi

echo "Searching issues in $REPO for: $QUERY"
echo "---"

# Search open issues
echo ""
echo "## Open Issues"
gh issue list --repo "$REPO" --state open --search "$QUERY" --limit 10

# Search closed issues (might be already fixed)
echo ""
echo "## Closed Issues (may already be fixed)"
gh issue list --repo "$REPO" --state closed --search "$QUERY" --limit 5

echo ""
echo "---"
echo "If no matches found, proceed with creating a new issue."
echo "If similar issue exists, consider commenting on it instead."
