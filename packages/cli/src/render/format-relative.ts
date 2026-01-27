/**
 * Date and time formatting utilities.
 *
 * Provides human-friendly relative time formatting.
 *
 * @packageDocumentation
 */

/**
 * Formats a date as a human-friendly relative time string.
 *
 * Converts timestamps to natural language like "just now", "5 minutes ago",
 * "yesterday", or "in 3 hours". Handles both past and future dates.
 *
 * @param date - Date to format (Date object, timestamp number, or ISO string)
 * @returns Human-friendly relative time string
 *
 * @example
 * ```typescript
 * formatRelative(new Date())              // "just now"
 * formatRelative(Date.now() - 30000)      // "30 seconds ago"
 * formatRelative(Date.now() - 3600000)    // "1 hour ago"
 * formatRelative(Date.now() + 300000)     // "in 5 minutes"
 * ```
 */
export function formatRelative(date: Date | number | string): string {
  // Convert input to timestamp
  let timestamp: number;

  if (date instanceof Date) {
    timestamp = date.getTime();
  } else if (typeof date === "number") {
    timestamp = date;
  } else {
    // Try parsing as ISO string
    const parsed = Date.parse(date);
    if (Number.isNaN(parsed)) {
      return "invalid date";
    }
    timestamp = parsed;
  }

  // Validate timestamp is a finite number (handles invalid Date, NaN, Infinity)
  if (!Number.isFinite(timestamp)) {
    return "invalid date";
  }

  const now = Date.now();
  const diffMs = now - timestamp;
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  // Time constants
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  // Just now (within 10 seconds)
  if (absDiffMs < 10 * SECOND) {
    return "just now";
  }

  // Seconds (10-59 seconds)
  if (absDiffMs < MINUTE) {
    const seconds = Math.floor(absDiffMs / SECOND);
    return isFuture ? `in ${seconds} seconds` : `${seconds} seconds ago`;
  }

  // Minutes (1-59 minutes)
  if (absDiffMs < HOUR) {
    const minutes = Math.floor(absDiffMs / MINUTE);
    if (minutes === 1) {
      return isFuture ? "in 1 minute" : "1 minute ago";
    }
    return isFuture ? `in ${minutes} minutes` : `${minutes} minutes ago`;
  }

  // Hours (1-23 hours)
  if (absDiffMs < DAY) {
    const hours = Math.floor(absDiffMs / HOUR);
    if (hours === 1) {
      return isFuture ? "in 1 hour" : "1 hour ago";
    }
    return isFuture ? `in ${hours} hours` : `${hours} hours ago`;
  }

  // Yesterday/Tomorrow (24-47 hours)
  if (absDiffMs < 2 * DAY) {
    return isFuture ? "tomorrow" : "yesterday";
  }

  // Days (2-29 days)
  if (absDiffMs < MONTH) {
    const days = Math.floor(absDiffMs / DAY);
    return isFuture ? `in ${days} days` : `${days} days ago`;
  }

  // Months (1-11 months)
  if (absDiffMs < YEAR) {
    const months = Math.floor(absDiffMs / MONTH);
    if (months === 1) {
      return isFuture ? "in 1 month" : "1 month ago";
    }
    return isFuture ? `in ${months} months` : `${months} months ago`;
  }

  // Years
  const years = Math.floor(absDiffMs / YEAR);
  if (years === 1) {
    return isFuture ? "in 1 year" : "1 year ago";
  }
  return isFuture ? `in ${years} years` : `${years} years ago`;
}
