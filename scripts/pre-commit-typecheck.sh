#!/usr/bin/env bash
# pre-commit-typecheck.sh
# Runs turbo typecheck only on packages that contain staged .ts/.tsx files.
# Called by lefthook with staged file paths as arguments.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Collect unique workspace directories from staged file paths.
# Workspace roots: packages/*, apps/*, plugins/*
# Uses a string-based dedup approach (Bash 3-compatible, no associative arrays).
seen_dirs=""
filters=()
has_non_workspace_ts=0

for file in "$@"; do
  # If any staged TS/TSX file is outside workspace package roots,
  # run full typecheck to cover root-level tooling/scripts changes.
  if [[ "$file" =~ \.(ts|tsx)$ ]] && [[ ! "$file" =~ ^(packages|apps|plugins)/([^/]+)/ ]]; then
    has_non_workspace_ts=1
    continue
  fi

  # Match workspace patterns: packages/<name>/..., apps/<name>/..., plugins/<name>/...
  if [[ "$file" =~ ^(packages|apps|plugins)/([^/]+)/ ]]; then
    ws_dir="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"

    # Skip already-seen directories
    case "$seen_dirs" in
      *"|$ws_dir|"*) continue ;;
    esac
    seen_dirs="${seen_dirs}|${ws_dir}|"

    # Read the package name from package.json
    pkg_json="$ROOT_DIR/$ws_dir/package.json"
    if [[ -f "$pkg_json" ]]; then
      pkg_name=$(bun -e "console.log(JSON.parse(await Bun.file('$pkg_json').text()).name)")
      if [[ -n "$pkg_name" ]]; then
        filters+=("--filter=$pkg_name")
      fi
    fi
  fi
done

if [[ $has_non_workspace_ts -eq 1 ]]; then
  echo "[typecheck] Non-workspace TS changes detected, running full typecheck"
  exec bun run typecheck -- --only
fi

if [[ ${#filters[@]} -eq 0 ]]; then
  # No workspace files staged (root-level .ts files, etc.) — fall back to full typecheck
  echo "[typecheck] No workspace packages detected, running full typecheck"
  exec bun run typecheck -- --only
fi

echo "[typecheck] Checking: ${filters[*]}"
exec bun x turbo run typecheck --no-daemon --only "${filters[@]}"
