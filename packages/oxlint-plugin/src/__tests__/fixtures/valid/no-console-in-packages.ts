import { getLogger } from "@logtape/logtape";

const logger = getLogger(["outfitter", "config"]);

/**
 * Package code routes diagnostics through structured logging
 * instead of console.* calls.
 */
export function loadConfiguration(path: string): void {
  logger.info("Loading configuration from {path}", { path });
}

export function reportWarning(message: string): void {
  logger.warn("Configuration warning: {message}", { message });
}

export function reportError(error: Error): void {
  logger.error("Configuration error: {error}", {
    error: error.message,
  });
}
