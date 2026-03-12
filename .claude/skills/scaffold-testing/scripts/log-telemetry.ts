#!/usr/bin/env bun

/**
 * PostToolUse hook script for scaffold-tester agent.
 *
 * Reads the PostToolUse payload from stdin and appends a JSONL line
 * to the telemetry log in the run directory.
 *
 * Env: OUTFITTER_SCAFFOLD_TRIAL_RUN_DIR — path to the run directory.
 * Always exits 0 to never block the agent.
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";

try {
  const runDir = process.env["OUTFITTER_SCAFFOLD_TRIAL_RUN_DIR"];
  if (!runDir) {
    process.exit(0);
  }

  const raw = await Bun.stdin.text();
  if (!raw.trim()) {
    process.exit(0);
  }

  const payload = JSON.parse(raw) as {
    tool_input?: { command?: string };
    tool_name?: string;
  };

  const command =
    typeof payload.tool_input?.command === "string"
      ? payload.tool_input.command
      : undefined;

  if (!command) {
    process.exit(0);
  }

  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    tool: payload.tool_name ?? "Bash",
    command,
  });

  appendFileSync(join(runDir, "telemetry.jsonl"), entry + "\n");
} catch {
  // Never block the agent
}

process.exit(0);
