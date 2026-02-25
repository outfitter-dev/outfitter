/**
 * Direct process.env access should be reported.
 */
export function getLogLevel(): string {
  return process.env["LOG_LEVEL"] ?? "info";
}

export function isDebugMode(): boolean {
  return process.env["DEBUG"] === "1";
}

export function getApiKey(): string | undefined {
  return process.env["API_KEY"];
}
