#!/usr/bin/env bun
/**
 * {{projectName}} daemon entry point
 */

import { createLogger } from "@outfitter/logging";

import { runDaemon } from "./daemon-main.js";

const logger = createLogger({ name: "{{binName}}d" });

runDaemon().catch((error: unknown) => {
  logger.error("Daemon failed", { error });
  process.exit(1);
});
