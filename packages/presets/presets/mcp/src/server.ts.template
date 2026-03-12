#!/usr/bin/env bun
/**
 * {{projectName}} MCP server entry point
 */

import { createLogger } from "@outfitter/logging";

import { startServer } from "./mcp.js";

const logger = createLogger({ name: "{{binName}}" });

startServer().catch((error: unknown) => {
  logger.error("Server failed", { error });
  process.exit(1);
});
