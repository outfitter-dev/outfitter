#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Install dependencies (idempotent)
bun install --frozen-lockfile || bun install

# Build all packages (needed for cross-package imports in tests)
bun run build
