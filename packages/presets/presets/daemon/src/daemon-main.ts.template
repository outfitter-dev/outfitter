/**
 * {{projectName}} daemon main logic
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

export async function runDaemon(): Promise<void> {
  const socketPath = getSocketPath(TOOL_NAME);
  const pidPath = getPidPath(TOOL_NAME);
  const daemonDir = getDaemonDir(TOOL_NAME);

  // Ensure daemon directory exists
  await mkdir(daemonDir, { recursive: true });

  // Create daemon with lifecycle management
  const daemon = createDaemon({
    name: TOOL_NAME,
    pidFile: pidPath,
    logger,
  });

  // Declare server reference so onShutdown can close it
  let server: ReturnType<typeof Bun.serve> | undefined;

  // Register server cleanup before start so signal handlers can reach it
  daemon.onShutdown(async () => {
    server?.stop();
  });

  // Start daemon (writes PID file, registers signal handlers)
  const startResult = await daemon.start();
  if (startResult.isErr()) {
    logger.error(`Failed to start daemon: ${startResult.error.message}`);
    process.exit(1);
  }

  logger.info(`Daemon starting on ${socketPath}`);

  // Create HTTP server on Unix socket
  server = Bun.serve({
    unix: socketPath,
    fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          uptime: Date.now() - startTime,
          version: "{{version}}",
        });
      }

      if (url.pathname === "/shutdown" && request.method === "POST") {
        logger.info("Shutdown requested");
        // Trigger graceful shutdown via daemon lifecycle
        setTimeout(() => void daemon.stop(), 100);
        return new Response("Shutting down");
      }

      return new Response("Not found", { status: 404 });
    },
  });

  logger.info("Daemon running");
}
