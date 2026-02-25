/**
 * Multiple console methods that should all be reported.
 */
export function debugOutput(data: unknown): void {
  console.log("Debug:", data);
}

export function warnUser(message: string): void {
  console.warn(`Warning: ${message}`);
}

export function reportError(error: Error): void {
  console.error("Fatal:", error.message);
}

export function showInfo(label: string, value: string): void {
  console.info(`${label}: ${value}`);
}
