/**
 * {{projectName}} daemon main logic
 *
 * Collects simple counters (requests, errors, uptime) and exposes them
 * via /health, /metrics, and /reset endpoints on a Unix socket.
 */

import { mkdir } from "node:fs/promises";

import {
  createDaemon,
  getDaemonDir,
  getPidPath,
  getSocketPath,
} from "@outfitter/daemon";
import { createLogger } from "@outfitter/logging";

const logger = createLogger({ name: "{{binName}}d" });

const TOOL_NAME = "{{binName}}";
const startTime = Date.now();

// =============================================================================
// Metrics store
// =============================================================================

interface Metrics {
  requests: number;
  errors: number;
}

const metrics: Metrics = { requests: 0, errors: 0 };

/** Reset all counters to zero. */
function resetMetrics(): void {
  metrics.requests = 0;
  metrics.errors = 0;
}

// =============================================================================
// Daemon
// =============================================================================

/** Start the metrics collector daemon. */
export async function runDaemon(): Promise<void> {
  const socketPath = getSocketPath(TOOL_NAME);
  const pidPath = getPidPath(TOOL_NAME);
  const daemonDir = getDaemonDir(TOOL_NAME);

  await mkdir(daemonDir, { recursive: true });

  const daemon = createDaemon({
    name: TOOL_NAME,
    pidFile: pidPath,
    logger,
  });

  // Register shutdown handler before start() so it's in place if the daemon
  // receives a signal immediately after starting. The server variable is
  // captured by closure and assigned before the daemon can actually shut down.
  let server: ReturnType<typeof Bun.serve> | undefined;
  daemon.onShutdown(async () => {
    server?.stop();
  });

  const startResult = await daemon.start();
  if (startResult.isErr()) {
    logger.error(`Failed to start daemon: ${startResult.error.message}`);
    process.exit(1);
  }

  logger.info(`Daemon starting on ${socketPath}`);

  server = Bun.serve({
    unix: socketPath,
    fetch(request) {
      const url = new URL(request.url);
      metrics.requests++;

      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          uptime: Date.now() - startTime,
          version: "{{version}}",
        });
      }

      if (url.pathname === "/metrics") {
        return Response.json({
          uptime: Date.now() - startTime,
          requests: metrics.requests,
          errors: metrics.errors,
          collectedAt: new Date().toISOString(),
        });
      }

      if (url.pathname === "/reset" && request.method === "POST") {
        resetMetrics();
        logger.info("Metrics reset");
        return Response.json({
          status: "reset",
          resetAt: new Date().toISOString(),
        });
      }

      if (url.pathname === "/shutdown" && request.method === "POST") {
        logger.info("Shutdown requested");
        setTimeout(() => void daemon.stop(), 100);
        return new Response("Shutting down");
      }

      metrics.errors++;
      return new Response("Not found", { status: 404 });
    },
  });

  logger.info("Daemon running");
}
