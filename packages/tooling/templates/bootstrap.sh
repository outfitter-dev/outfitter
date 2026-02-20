#!/usr/bin/env bash
#
# bootstrap.sh — Get this repo from clone to runnable
#
# Usage: ./scripts/bootstrap.sh [--force]
#
# By default, exits immediately if all tools and deps are present.
# Use --force to run full bootstrap regardless.
#
# Add project-specific tools (e.g., Graphite) by extending this script.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUN_VERSION_FILE="$REPO_ROOT/.bun-version"
PINNED_BUN_VERSION=""

if [[ -f "$BUN_VERSION_FILE" ]]; then
  PINNED_BUN_VERSION="$(tr -d '[:space:]' < "$BUN_VERSION_FILE")"
  if [[ -z "$PINNED_BUN_VERSION" ]]; then
    echo "Warning: .bun-version is empty; falling back to latest Bun install" >&2
  fi
fi

# -----------------------------------------------------------------------------
# Fast path — exit immediately if all tools and deps are present
# -----------------------------------------------------------------------------
if [[ "${1:-}" != "--force" ]]; then
  all_present=true

  if command -v bun &>/dev/null; then
    installed_bun_version="$(bun --version)"
    if [[ -n "$PINNED_BUN_VERSION" ]]; then
      [[ "$installed_bun_version" == "$PINNED_BUN_VERSION" ]] || all_present=false
    fi
  else
    all_present=false
  fi

  command -v gh &>/dev/null || all_present=false
  command -v markdownlint-cli2 &>/dev/null || all_present=false
  [[ -d "$REPO_ROOT/node_modules" ]] || all_present=false

  if $all_present; then
    exit 0  # All good, nothing to do
  fi
fi

# Strip --force if present
[[ "${1:-}" == "--force" ]] && shift

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; }

# Check if command exists
has() { command -v "$1" &>/dev/null; }

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) IS_MACOS=true ;;
  Linux)  IS_MACOS=false ;;
  *)      error "Unsupported OS: $OS"; exit 1 ;;
esac

# -----------------------------------------------------------------------------
# Homebrew (macOS only)
# -----------------------------------------------------------------------------
install_homebrew() {
  if $IS_MACOS && ! has brew; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    success "Homebrew installed"
  fi
}

# -----------------------------------------------------------------------------
# Bun
# -----------------------------------------------------------------------------
install_bun() {
  local installed_bun_version=""

  if has bun; then
    installed_bun_version="$(bun --version)"
  fi

  if [[ -n "$installed_bun_version" ]]; then
    if [[ -n "$PINNED_BUN_VERSION" && "$installed_bun_version" == "$PINNED_BUN_VERSION" ]]; then
      success "Bun already installed ($installed_bun_version)"
      return
    fi
    if [[ -z "$PINNED_BUN_VERSION" ]]; then
      success "Bun already installed ($installed_bun_version)"
      return
    fi
  fi

  if [[ -n "$PINNED_BUN_VERSION" && -n "$installed_bun_version" ]]; then
    info "Updating Bun from $installed_bun_version to $PINNED_BUN_VERSION..."
  elif [[ -n "$PINNED_BUN_VERSION" ]]; then
    info "Installing Bun $PINNED_BUN_VERSION..."
  else
    info "Installing Bun (latest stable)..."
  fi

  if [[ -n "$PINNED_BUN_VERSION" ]]; then
    curl -fsSL https://bun.sh/install | bash -s -- "bun-v$PINNED_BUN_VERSION"
  else
    curl -fsSL https://bun.sh/install | bash
  fi

  # Source the updated profile
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  hash -r

  local resolved_bun_version
  resolved_bun_version="$(bun --version)"

  if [[ -n "$PINNED_BUN_VERSION" && "$resolved_bun_version" != "$PINNED_BUN_VERSION" ]]; then
    error "Expected Bun $PINNED_BUN_VERSION but found $resolved_bun_version after install"
    exit 1
  fi

  success "Bun ready ($resolved_bun_version)"
}

# -----------------------------------------------------------------------------
# GitHub CLI (gh)
# -----------------------------------------------------------------------------
install_gh() {
  if has gh; then
    success "GitHub CLI already installed ($(gh --version | head -1))"
  else
    info "Installing GitHub CLI..."
    if $IS_MACOS; then
      brew install gh
    else
      # Linux: use official apt repo
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
      sudo apt update && sudo apt install gh -y
    fi
    success "GitHub CLI installed"
  fi
}

# -----------------------------------------------------------------------------
# markdownlint-cli2
# -----------------------------------------------------------------------------
install_markdownlint() {
  if has markdownlint-cli2; then
    success "markdownlint-cli2 already installed"
  else
    info "Installing markdownlint-cli2..."
    bun install -g markdownlint-cli2
    success "markdownlint-cli2 installed"
  fi
}

# -----------------------------------------------------------------------------
# Auth checks
# -----------------------------------------------------------------------------
check_auth() {
  echo ""
  info "Checking authentication..."

  # GitHub CLI
  if [[ -n "${GH_TOKEN:-}" ]] || [[ -n "${GITHUB_TOKEN:-}" ]]; then
    success "GitHub CLI token found in environment"
  elif gh auth status &>/dev/null; then
    success "GitHub CLI already authenticated"
  else
    echo "    GitHub CLI not authenticated. Run 'gh auth login' or set GH_TOKEN"
  fi

  # Add project-specific auth checks (e.g., Graphite) below
}

# -----------------------------------------------------------------------------
# Project dependencies
# -----------------------------------------------------------------------------
install_deps() {
  info "Installing project dependencies..."
  (
    cd "$REPO_ROOT"
    bun install
  )
  success "Dependencies installed"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  echo ""
  echo -e "${BLUE}Outfitter Bootstrap${NC}"
  echo "────────────────────────"
  echo ""

  # Prerequisites
  if $IS_MACOS; then
    install_homebrew
  fi

  # Core tools
  install_bun
  install_gh
  install_markdownlint
  # Add project-specific tools (e.g., Graphite) below

  # Auth status
  check_auth

  echo ""

  # Project setup
  install_deps

  echo ""
  echo -e "${GREEN}Bootstrap complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "  bun run build      # Build all packages"
  echo "  bun run test       # Run tests"
  echo ""
}

main "$@"
