#!/usr/bin/env bash
set -euo pipefail

# Bunup mutates package.json exports as part of each build. Under parallel
# turbo builds those writes can race, so serialize bunup itself instead of the
# entire task graph.

lock_root=".outfitter/locks"
lock_dir="$lock_root/bunup.lock"
pid_file="$lock_dir/pid"
timeout_seconds="${OUTFITTER_BUNUP_LOCK_TIMEOUT_SECONDS:-300}"
start_time="$(date +%s)"

mkdir -p "$lock_root"

cleanup() {
  if [[ -d "$lock_dir" ]] && [[ "$(cat "$pid_file" 2>/dev/null || true)" == "$$" ]]; then
    rm -rf "$lock_dir"
  fi
}

trap cleanup EXIT

while ! mkdir "$lock_dir" 2>/dev/null; do
  existing_pid="$(cat "$pid_file" 2>/dev/null || true)"

  # A killed owner can leave the lock dir behind before it ever writes its PID.
  # Give that bootstrap path one short grace period, then reclaim the lock.
  if [[ -z "$existing_pid" ]]; then
    sleep 0.2
    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -z "$existing_pid" ]]; then
      rm -rf "$lock_dir"
      continue
    fi
  fi

  if ! kill -0 "$existing_pid" 2>/dev/null; then
    rm -rf "$lock_dir"
    continue
  fi

  if (( "$(date +%s)" - start_time >= timeout_seconds )); then
    printf "Timed out waiting for bunup lock after %ss\n" "$timeout_seconds" >&2
    exit 1
  fi

  sleep 0.1
done

printf "%s\n" "$$" > "$pid_file"
"$@"
