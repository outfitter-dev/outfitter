/**
 * Result of checking a CLI tool's availability and version.
 */
export interface ToolCheckResult {
  /** Whether the tool is available in PATH */
  available: boolean;
  /** Tool category for grouping */
  category: string;
  /** Command used to invoke the tool */
  command: string;
  /** Human-readable description */
  description: string;
  /** Installation instructions by package manager */
  install: {
    brew?: string;
    cargo?: string;
    apt?: string;
    url: string;
  };
  /** Tool display name */
  name: string;
  /** Standard tool this replaces (e.g., fd replaces find) */
  replaces?: string;
  /** Version string if available */
  version?: string;
}

/**
 * Tool categories for grouping related tools.
 */
export type Category = "search" | "json" | "viewers" | "navigation" | "http";

/**
 * Output format for tool check results.
 */
export type OutputFormat = "json" | "text";
