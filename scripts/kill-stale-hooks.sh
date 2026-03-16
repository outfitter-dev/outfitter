#!/usr/bin/env bash
# Kill stale lefthook/turbo processes from prior sessions.
#
# When a previous gt submit or git push is interrupted, lefthook and turbo
# processes can remain running indefinitely, blocking new pushes via the
# turbo daemon lock.
#
# This script:
# 1. Checks for a PID file from a prior pre-push run
# 2. If the process is still alive and older than 30 minutes, kills it
# 3. Writes the parent (lefthook) PID so it persists through the verify step
#
# Identity verification: stores both PID and process start time. On check,
# verifies the start time matches — if the PID was recycled to a different
# process, the start time won't match and we skip it.
#
# See: https://linear.app/outfitter/issue/OS-532

set -euo pipefail

PID_FILE="/tmp/outfitter-pre-push.pid"
MAX_AGE_MINUTES=30

# macOS-portable process age in seconds.
# macOS `ps` doesn't support `etimes`, so we parse `etime` (DD-HH:MM:SS).
get_process_age_seconds() {
  local pid="$1"
  local etime
  etime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ') || return 1

  if [ -z "$etime" ]; then
    return 1
  fi

  # Parse etime format: [[DD-]HH:]MM:SS
  local days=0 hours=0 minutes=0 seconds=0

  if [[ "$etime" == *-* ]]; then
    days="${etime%%-*}"
    etime="${etime#*-}"
  fi

  # Split remaining by ':'
  IFS=':' read -ra parts <<< "$etime"
  local n=${#parts[@]}
  if [ "$n" -ge 1 ]; then seconds=$((10#${parts[$((n-1))]})); fi
  if [ "$n" -ge 2 ]; then minutes=$((10#${parts[$((n-2))]})); fi
  if [ "$n" -ge 3 ]; then hours=$((10#${parts[$((n-3))]})); fi

  echo $(( 10#$days * 86400 + hours * 3600 + minutes * 60 + seconds ))
}

# Get process start time as a stable identifier for PID recycling detection.
# Returns a string like "Mon Mar 16 14:30:00 2026" (from ps lstart).
# Returns exit code 0 even on empty output (e.g. zombie); callers must check
# the returned string with [ -z ... ] in addition to the || guard.
get_process_start_time() {
  LC_ALL=C ps -o lstart= -p "$1" 2>/dev/null | tr -s ' ' | sed 's/^ //;s/ $//'
}

kill_stale_process() {
  local pid="$1"
  local stored_start="$2"

  # Check if process is still running
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  # Verify this is the same process we stored, not a recycled PID.
  # Compare process start time — if it doesn't match, the PID was reused.
  if [ -n "$stored_start" ]; then
    local actual_start
    actual_start=$(get_process_start_time "$pid") || return 0
    if [ "$actual_start" != "$stored_start" ]; then
      # PID was recycled to a different process
      return 0
    fi
  fi

  # Check process age
  local elapsed
  elapsed=$(get_process_age_seconds "$pid") || return 0

  local max_age_seconds=$((MAX_AGE_MINUTES * 60))
  if [ "$elapsed" -gt "$max_age_seconds" ]; then
    local cmd
    cmd=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ') || cmd="unknown"
    echo "[hooks] Killing stale pre-push process (PID $pid, ${cmd}, age ${elapsed}s)"
    # Kill the process group to catch child turbo/bun processes
    local killed=false
    kill -- -"$pid" 2>/dev/null && killed=true || kill "$pid" 2>/dev/null && killed=true || true
    if $killed; then
      sleep 1
      # Force kill only if still alive
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    return 0
  fi

  # Process is recent — another push is genuinely running
  local cmd
  cmd=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ') || cmd="unknown"
  echo "[hooks] Warning: another pre-push process is running (PID $pid, ${cmd}, age ${elapsed}s)"
  return 1
}

# Check and clean up stale process from prior run
if [ -f "$PID_FILE" ]; then
  stored_pid=""
  stored_start=""
  # PID file format: "PID START_TIME" (space-separated, start time may contain spaces)
  if IFS= read -r line < "$PID_FILE" 2>/dev/null; then
    stored_pid="${line%% *}"
    stored_start="${line#* }"
    # If no space found, stored_start equals stored_pid (no start time stored)
    if [ "$stored_start" = "$stored_pid" ]; then
      stored_start=""
    fi
  fi

  if [ -n "$stored_pid" ]; then
    if ! kill_stale_process "$stored_pid" "$stored_start"; then
      # Live concurrent process detected — block this push to avoid daemon lock contention
      echo "[hooks] Aborting: another pre-push is already running (PID $stored_pid). Wait for it to finish or kill it manually."
      exit 1
    fi
  fi
fi

# Resolve lefthook's PID. Lefthook invokes run: commands via sh -c, so the
# process tree is: lefthook → sh → bash (this script). $PPID is sh, not
# lefthook. Traverse one level up to get lefthook's actual PID.
lefthook_pid=$(ps -o ppid= -p "${PPID:-$$}" 2>/dev/null | tr -d ' ') || lefthook_pid=""
target_pid="${lefthook_pid:-${PPID:-$$}}"

# Store PID and start time together for identity verification on next run
start_time=$(get_process_start_time "$target_pid") || start_time=""
echo "${target_pid}${start_time:+ ${start_time}}" > "$PID_FILE"
