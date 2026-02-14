/**
 * Formatting utilities for human-readable output.
 *
 * Provides functions to format durations and byte sizes.
 *
 * @packageDocumentation
 */

/**
 * Formats milliseconds as human-readable duration.
 *
 * Converts milliseconds to a compact, human-friendly format using
 * h (hours), m (minutes), s (seconds), or ms (milliseconds).
 *
 * @param ms - Duration in milliseconds
 * @returns Human-friendly duration string
 *
 * @example
 * ```typescript
 * formatDuration(150)     // "150ms"
 * formatDuration(45000)   // "45s"
 * formatDuration(9015000) // "2h 30m 15s"
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Formats bytes as human-readable size.
 *
 * Converts bytes to a compact format using appropriate units
 * (B, KB, MB, GB, TB). Uses 1024-based (binary) units.
 *
 * @param bytes - Size in bytes
 * @returns Human-friendly size string
 *
 * @example
 * ```typescript
 * formatBytes(500)        // "500 B"
 * formatBytes(1536)       // "1.5 KB"
 * formatBytes(1073741824) // "1 GB"
 * ```
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted =
    unitIndex === 0 ? size.toString() : size.toFixed(1).replace(/\.0$/, "");
  return `${formatted} ${units[unitIndex]}`;
}
