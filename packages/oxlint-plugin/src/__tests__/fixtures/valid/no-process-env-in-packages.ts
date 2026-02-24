import type { EnvironmentConfig } from "./types.js";

/**
 * Package code receives environment configuration through explicit
 * context wiring instead of reading process.env directly.
 */
export function resolveEnvironment(config: EnvironmentConfig): string {
  return config.env;
}

export function resolveLogLevel(config: EnvironmentConfig): string {
  return config.logLevel ?? "info";
}

/**
 * process.cwd() is fine in packages -- only process.env is disallowed.
 */
export function getWorkingDirectory(): string {
  return process.cwd();
}
