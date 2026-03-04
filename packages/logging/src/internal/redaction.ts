import type { GlobalRedactionConfig, RedactionConfig } from "./types.js";

// ============================================================================
// Default Patterns and State
// ============================================================================

/** Default sensitive keys that should always be redacted (case-insensitive) */
const DEFAULT_SENSITIVE_KEYS = ["password", "secret", "token", "apikey"];

/**
 * Default patterns for redacting secrets from log messages.
 * Applied to message strings and stringified metadata values.
 *
 * Patterns include:
 * - Bearer tokens (Authorization headers)
 * - API key patterns (api_key=xxx, apikey: xxx)
 * - GitHub Personal Access Tokens (ghp_xxx)
 * - GitHub OAuth tokens (gho_xxx)
 * - GitHub App tokens (ghs_xxx)
 * - GitHub refresh tokens (ghr_xxx)
 * - PEM-encoded private keys
 *
 * @example
 * ```typescript
 * import { DEFAULT_PATTERNS } from "@outfitter/logging";
 *
 * // Use with custom logger configuration
 * const logger = createLogger({
 *   name: "app",
 *   redaction: {
 *     enabled: true,
 *     patterns: [...DEFAULT_PATTERNS, /my-custom-secret-\w+/gi],
 *   },
 * });
 * ```
 */
export const DEFAULT_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, // Bearer tokens
  /(?:api[_-]?key|apikey)[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi, // API keys
  /ghp_[A-Za-z0-9]{36}/g, // GitHub PATs
  /gho_[A-Za-z0-9]{36}/g, // GitHub OAuth tokens
  /ghs_[A-Za-z0-9]{36}/g, // GitHub App tokens
  /ghr_[A-Za-z0-9]{36}/g, // GitHub refresh tokens
  /-----BEGIN[\s\S]*?PRIVATE\s*KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE\s*KEY-----/gi, // PEM keys
];

/** Global redaction configuration */
export const globalRedactionConfig: GlobalRedactionConfig = {
  patterns: [],
  keys: [],
};

// ============================================================================
// Redaction Functions
// ============================================================================

/**
 * Check if a key should be redacted (case-insensitive).
 */
function isRedactedKey(key: string, additionalKeys: string[]): boolean {
  const lowerKey = key.toLowerCase();
  const allKeys = [...DEFAULT_SENSITIVE_KEYS, ...additionalKeys];
  return allKeys.some((k) => lowerKey === k.toLowerCase());
}

/**
 * Apply regex patterns to redact values in strings.
 */
export function applyPatterns(
  value: string,
  patterns: RegExp[],
  replacement: string
): string {
  let result = value;
  for (const pattern of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Recursively redact sensitive data from an object.
 */
function redactValue(
  value: unknown,
  keys: string[],
  patterns: RegExp[],
  replacement: string,
  currentKey?: string
): unknown {
  // Check if this key should be fully redacted
  if (currentKey !== undefined && isRedactedKey(currentKey, keys)) {
    return replacement;
  }

  // Handle string values - apply patterns
  if (typeof value === "string") {
    return applyPatterns(value, patterns, replacement);
  }

  // Handle arrays - recurse into each element
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keys, patterns, replacement));
  }

  // Handle Error objects - serialize them
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  // Handle plain objects - recurse into properties
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = redactValue(v, keys, patterns, replacement, k);
    }
    return result;
  }

  // Return primitives as-is
  return value;
}

/**
 * Recursively process nested objects to serialize errors.
 */
function processNestedForErrors(obj: object): unknown {
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (item !== null && typeof item === "object") {
        return processNestedForErrors(item);
      }
      return item;
    });
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    } else if (value !== null && typeof value === "object") {
      result[key] = processNestedForErrors(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Process metadata: apply redaction and serialize errors.
 */
export function processMetadata(
  metadata: Record<string, unknown> | undefined,
  redactionConfig: RedactionConfig | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  // Serialize errors even without redaction
  const processed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value instanceof Error) {
      processed[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      // Recursively process nested objects to handle nested errors
      processed[key] = processNestedForErrors(value);
    } else {
      processed[key] = value;
    }
  }

  // Honor explicit opt-out even with global rules
  if (redactionConfig?.enabled === false) {
    return processed;
  }

  // Check if global redaction rules exist
  const hasGlobalRules =
    (globalRedactionConfig.patterns?.length ?? 0) > 0 ||
    (globalRedactionConfig.keys?.length ?? 0) > 0;

  // Apply redaction if:
  // 1. redactionConfig is provided and enabled !== false, OR
  // 2. Global redaction rules exist (patterns or keys)
  if (redactionConfig || hasGlobalRules) {
    const allPatterns = [
      ...DEFAULT_PATTERNS,
      ...(redactionConfig?.patterns ?? []),
      ...(globalRedactionConfig.patterns ?? []),
    ];
    const allKeys = [
      ...(redactionConfig?.keys ?? []),
      ...(globalRedactionConfig.keys ?? []),
    ];
    const replacement = redactionConfig?.replacement ?? "[REDACTED]";

    return redactValue(processed, allKeys, allPatterns, replacement) as Record<
      string,
      unknown
    >;
  }

  return processed;
}

/**
 * Merge redaction configurations with additive keys/patterns and last-wins
 * scalar fields.
 */
export function mergeRedactionConfig(
  base: RedactionConfig | undefined,
  override: RedactionConfig | undefined
): RedactionConfig | undefined {
  if (!(base || override)) {
    return undefined;
  }

  const merged: RedactionConfig = {};
  const keys = [...(base?.keys ?? []), ...(override?.keys ?? [])];
  const patterns = [...(base?.patterns ?? []), ...(override?.patterns ?? [])];

  if (keys.length > 0) {
    merged.keys = keys;
  }

  if (patterns.length > 0) {
    merged.patterns = patterns;
  }

  if (base?.enabled !== undefined) {
    merged.enabled = base.enabled;
  }
  if (override?.enabled !== undefined) {
    merged.enabled = override.enabled;
  }

  if (base?.replacement !== undefined) {
    merged.replacement = base.replacement;
  }
  if (override?.replacement !== undefined) {
    merged.replacement = override.replacement;
  }

  return merged;
}

/**
 * Configure global redaction patterns and keys that apply to all loggers.
 *
 * @param config - Global redaction configuration
 *
 * @example
 * ```typescript
 * configureRedaction({
 *   patterns: [/custom-secret-\d+/g],
 *   keys: ["myCustomKey"],
 * });
 * ```
 */
export function configureRedaction(config: GlobalRedactionConfig): void {
  if (config.patterns) {
    globalRedactionConfig.patterns = [
      ...(globalRedactionConfig.patterns ?? []),
      ...config.patterns,
    ];
  }
  if (config.keys) {
    globalRedactionConfig.keys = [
      ...(globalRedactionConfig.keys ?? []),
      ...config.keys,
    ];
  }
}
