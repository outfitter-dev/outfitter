#!/usr/bin/env bash
# format-code-on-stop.sh
# Formats code and markdown files changed during the session.
# Designed for Claude Code Stop hook - runs after agent completes work.

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# File patterns for each formatter
CODE_PATTERNS="*.js *.jsx *.ts *.tsx *.json *.jsonc *.css"
MARKDOWN_PATTERNS="*.md"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

log() {
  echo "[format] $*"
}

warn() {
  echo "[format] WARNING: $*" >&2
}

hint() {
  echo "[format] HINT: $*" >&2
}

# Check if a command exists
has_cmd() {
  command -v "$1" &>/dev/null
}

# Get changed files (staged + unstaged, excluding deleted)
get_changed_files() {
  local patterns=("$@")
  local files=()

  # Get both staged and unstaged changes, excluding deleted files
  for pattern in "${patterns[@]}"; do
    while IFS= read -r file; do
      [[ -n "$file" && -f "$file" ]] && files+=("$file")
    done < <(git diff --name-only --diff-filter=d HEAD -- "$pattern" 2>/dev/null || true)

    # Also check untracked files matching pattern
    while IFS= read -r file; do
      [[ -n "$file" && -f "$file" ]] && files+=("$file")
    done < <(git ls-files --others --exclude-standard -- "$pattern" 2>/dev/null || true)
  done

  # Deduplicate
  printf '%s\n' "${files[@]}" | sort -u
}

# -----------------------------------------------------------------------------
# Formatters
# -----------------------------------------------------------------------------

format_code() {
  local files=()

  # Collect changed code files
  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(get_changed_files $CODE_PATTERNS)

  if [[ ${#files[@]} -eq 0 ]]; then
    log "No code files to format"
    return 0
  fi

  log "Formatting ${#files[@]} code file(s)..."

  # Check for bun
  if ! has_cmd bun; then
    warn "bun not found - skipping code formatting"
    hint "Install bun: curl -fsSL https://bun.sh/install | bash"
    return 0
  fi

  # Check for ultracite (via bun x)
  if ! bun x ultracite --version &>/dev/null; then
    warn "ultracite not available - skipping code formatting"
    hint "Install ultracite: bun add -d ultracite"
    return 0
  fi

  # Run ultracite fix on changed files
  if bun x ultracite fix "${files[@]}" 2>/dev/null; then
    log "Code formatting complete"
  else
    warn "ultracite encountered errors (non-fatal)"
  fi
}

format_markdown() {
  local files=()

  # Collect changed markdown files
  while IFS= read -r file; do
    [[ -n "$file" ]] && files+=("$file")
  done < <(get_changed_files $MARKDOWN_PATTERNS)

  if [[ ${#files[@]} -eq 0 ]]; then
    log "No markdown files to format"
    return 0
  fi

  log "Formatting ${#files[@]} markdown file(s)..."

  # Check for markdownlint-cli2
  if has_cmd markdownlint-cli2; then
    if markdownlint-cli2 --fix "${files[@]}" 2>/dev/null; then
      log "Markdown formatting complete"
    else
      warn "markdownlint-cli2 encountered errors (non-fatal)"
    fi
    return 0
  fi

  # Try via bunx/npx
  if has_cmd bun && bun x markdownlint-cli2 --help &>/dev/null; then
    if bun x markdownlint-cli2 --fix "${files[@]}" 2>/dev/null; then
      log "Markdown formatting complete"
    else
      warn "markdownlint-cli2 encountered errors (non-fatal)"
    fi
    return 0
  fi

  if has_cmd npx && npx markdownlint-cli2 --help &>/dev/null; then
    if npx markdownlint-cli2 --fix "${files[@]}" 2>/dev/null; then
      log "Markdown formatting complete"
    else
      warn "markdownlint-cli2 encountered errors (non-fatal)"
    fi
    return 0
  fi

  warn "markdownlint-cli2 not found - skipping markdown formatting"
  hint "Install: bun add -g markdownlint-cli2  OR  npm install -g markdownlint-cli2"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  # Ensure we're in a git repo
  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    warn "Not in a git repository - skipping formatting"
    exit 0
  fi

  # Change to repo root
  cd "$(git rev-parse --show-toplevel)"

  log "Checking for files to format..."

  format_code
  format_markdown

  log "Done"
}

main "$@"
