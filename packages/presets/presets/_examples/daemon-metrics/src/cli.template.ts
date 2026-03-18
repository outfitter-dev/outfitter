#!/usr/bin/env bun
/**
 * {{projectName}} CLI entry point
 *
 * Commands: start, stop, status, health, metrics, reset
 */

import { spawn } from "node:child_process";

import { createCLI, command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import {
  ConflictError,
  NetworkError,
  NotFoundError,
  Result,
} from "@outfitter/contracts";
import { getSocketPath, getPidPath, isDaemonAlive } from "@outfitter/daemon";

const TOOL_NAME = "{{binName}}";
const socketPath = getSocketPath(TOOL_NAME);
const pidPath = getPidPath(TOOL_NAME);

const program = createCLI({
  name: "{{binName}}",
  version: "{{version}}",
  description: "{{description}}",
});

// =============================================================================
// start
// =============================================================================

program.register(
  command("start")
    .description("Start the metrics daemon")
    .option("-f, --foreground", "Run in foreground")
    .action(async ({ flags }) => {
      const foreground = Boolean(flags["foreground"]);

      await runHandler({
        command: "start",
        input: { foreground },
        handler: async ({ foreground: fg }) => {
          if (await isDaemonAlive(pidPath)) {
            return Result.err(
              ConflictError.create("Daemon is already running")
            );
          }

          if (fg) {
            const { runDaemon } = await import("./daemon-main.js");
            await runDaemon();
            return Result.ok({ status: "exited", mode: "foreground" });
          }

          const daemon = spawn(
            process.execPath,
            [import.meta.dir + "/daemon.js"],
            { detached: true, stdio: "ignore" }
          );
          daemon.unref();
          return Result.ok({
            status: "started",
            pid: daemon.pid ?? null,
            mode: "background",
          });
        },
      });
    })
);

// =============================================================================
// stop
// =============================================================================

program.register(
  command("stop")
    .description("Stop the metrics daemon")
    .action(async () => {
      await runHandler({
        command: "stop",
        input: {},
        handler: async () => {
          if (!(await isDaemonAlive(pidPath))) {
            return Result.err(NotFoundError.create("daemon", "process"));
          }

          try {
            const response = await fetch(
              `http://unix:${socketPath}:/shutdown`,
              { method: "POST" }
            );
            if (!response.ok) {
              return Result.err(NetworkError.create("Failed to stop daemon"));
            }
          } catch {
            return Result.err(
              NetworkError.create("Failed to reach daemon process")
            );
          }

          return Result.ok({ status: "stopped" });
        },
        onError: () => [
          { description: "Check status", command: "{{binName}} status" },
        ],
      });
    })
);

// =============================================================================
// status
// =============================================================================

program.register(
  command("status")
    .description("Check daemon status")
    .readOnly(true)
    .action(async () => {
      await runHandler({
        command: "status",
        input: {},
        handler: async () => {
          const alive = await isDaemonAlive(pidPath);
          if (!alive) {
            return Result.ok({ running: false });
          }

          try {
            const response = await fetch(`http://unix:${socketPath}:/health`);
            if (!response.ok) {
              return Result.ok({ running: true, health: "unknown" });
            }
            const health: Record<string, unknown> = await response.json();
            return Result.ok({ ...health, running: true });
          } catch {
            return Result.ok({ running: true, health: "unknown" });
          }
        },
      });
    })
);

// =============================================================================
// health
// =============================================================================

program.register(
  command("health")
    .description("Check daemon health")
    .readOnly(true)
    .action(async () => {
      await runHandler({
        command: "health",
        input: {},
        handler: async () => {
          if (!(await isDaemonAlive(pidPath))) {
            return Result.err(NotFoundError.create("daemon", "process"));
          }

          try {
            const response = await fetch(`http://unix:${socketPath}:/health`);
            if (!response.ok) {
              return Result.err(
                NetworkError.create("Health endpoint returned non-OK")
              );
            }
            const health: Record<string, unknown> = await response.json();
            return Result.ok(health);
          } catch {
            return Result.err(
              NetworkError.create("Failed to reach daemon health endpoint")
            );
          }
        },
        onError: () => [
          { description: "Start daemon", command: "{{binName}} start" },
        ],
      });
    })
);

// =============================================================================
// metrics
// =============================================================================

program.register(
  command("metrics")
    .description("Fetch current metrics from the daemon")
    .readOnly(true)
    .action(async () => {
      await runHandler({
        command: "metrics",
        input: {},
        handler: async () => {
          if (!(await isDaemonAlive(pidPath))) {
            return Result.err(NotFoundError.create("daemon", "process"));
          }

          try {
            const response = await fetch(`http://unix:${socketPath}:/metrics`);
            if (!response.ok) {
              return Result.err(
                NetworkError.create("Metrics endpoint returned non-OK")
              );
            }
            const data: Record<string, unknown> = await response.json();
            return Result.ok(data);
          } catch {
            return Result.err(
              NetworkError.create("Failed to reach daemon metrics endpoint")
            );
          }
        },
        onError: () => [
          { description: "Start daemon", command: "{{binName}} start" },
          { description: "Check health", command: "{{binName}} health" },
        ],
      });
    })
);

// =============================================================================
// reset
// =============================================================================

program.register(
  command("reset")
    .description("Reset all metrics counters to zero")
    .destructive(true)
    .action(async () => {
      await runHandler({
        command: "reset",
        input: {},
        handler: async () => {
          if (!(await isDaemonAlive(pidPath))) {
            return Result.err(NotFoundError.create("daemon", "process"));
          }

          try {
            const response = await fetch(`http://unix:${socketPath}:/reset`, {
              method: "POST",
            });
            if (!response.ok) {
              return Result.err(
                NetworkError.create("Reset endpoint returned non-OK")
              );
            }
            const data: Record<string, unknown> = await response.json();
            return Result.ok(data);
          } catch {
            return Result.err(
              NetworkError.create("Failed to reach daemon reset endpoint")
            );
          }
        },
        hints: () => [
          { description: "View metrics", command: "{{binName}} metrics" },
        ],
        onError: () => [
          { description: "Start daemon", command: "{{binName}} start" },
        ],
      });
    })
);

program.parse(process.argv);
