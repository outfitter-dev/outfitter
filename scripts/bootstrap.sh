#!/usr/bin/env bash
#
# bootstrap.sh — Get this repo from clone to runnable
#
# Usage: ./scripts/bootstrap.sh [--force]
#
# By default, exits immediately if all tools and deps are present.
# Use --force to run full bootstrap regardless.
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Fast path — exit immediately if all tools and deps are present
# -----------------------------------------------------------------------------
if [[ "${1:-}" != "--force" ]]; then
  all_present=true
  command -v bun &>/dev/null || all_present=false
  command -v gh &>/dev/null || all_present=false
  command -v gt &>/dev/null || all_present=false
  command -v markdownlint-cli2 &>/dev/null || all_present=false
  [[ -d "node_modules" ]] || all_present=false

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
  if has bun; then
    success "Bun already installed ($(bun --version))"
  else
    info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    # Source the updated profile
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    success "Bun installed ($(bun --version))"
  fi
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
# Graphite CLI (gt)
# -----------------------------------------------------------------------------
install_graphite() {
  if has gt; then
    success "Graphite CLI already installed ($(gt --version 2>/dev/null || echo 'unknown'))"
  else
    info "Installing Graphite CLI..."
    if $IS_MACOS && has brew; then
      brew install withgraphite/tap/graphite
    else
      bun install -g @withgraphite/graphite-cli
    fi
    success "Graphite CLI installed"
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

  # Graphite CLI
  if [[ -n "${GT_AUTH_TOKEN:-}" ]]; then
    info "Authenticating Graphite CLI..."
    gt auth --token "$GT_AUTH_TOKEN"
    success "Graphite CLI authenticated"
  elif gt auth status &>/dev/null 2>&1; then
    success "Graphite CLI already authenticated"
  else
    echo "    Graphite CLI not authenticated. Run 'gt auth' or set GT_AUTH_TOKEN"
  fi
}

# -----------------------------------------------------------------------------
# Project dependencies
# -----------------------------------------------------------------------------
install_deps() {
  info "Installing project dependencies..."
  bun install
  success "Dependencies installed"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  echo ""
  echo -e "${BLUE}Outfitter Kit Bootstrap${NC}"
  echo "────────────────────────"
  echo ""

  # Prerequisites
  if $IS_MACOS; then
    install_homebrew
  fi

  # Core tools
  install_bun
  install_gh
  install_graphite
  install_markdownlint

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
