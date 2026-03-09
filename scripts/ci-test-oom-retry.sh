#!/usr/bin/env bash
# OOM-aware test runner for CI shards.
# Retries up to MAX_ATTEMPTS times on exit 137 (OOM kill).
# Expects `bun run test:ci` to be the test command (reads OUTFITTER_CI_* env vars).
set -euo pipefail

MAX_ATTEMPTS="${CI_TEST_MAX_ATTEMPTS:-3}"
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "::group::Attempt $attempt of $MAX_ATTEMPTS"
  set +e
  bun run test:ci 2>&1 | tee /tmp/test-output.log
  exit_code=${PIPESTATUS[0]}
  set -e
  echo "::endgroup::"

  if [ "$exit_code" -eq 0 ]; then
    exit 0
  fi

  is_oom=false
  if [ "$exit_code" -eq 137 ]; then
    is_oom=true
  elif grep -q 'exited (137)\|exitCode=137\|exit code 137' /tmp/test-output.log 2>/dev/null; then
    is_oom=true
  fi

  if [ "$is_oom" = false ]; then
    echo "::error::test:ci failed with exit code $exit_code"
    exit "$exit_code"
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "::error::OOM (exit 137) persisted after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  echo "::warning::OOM detected (exit 137), retrying (attempt $((attempt + 1)) of $MAX_ATTEMPTS)..."
  attempt=$((attempt + 1))
done

exit 1
