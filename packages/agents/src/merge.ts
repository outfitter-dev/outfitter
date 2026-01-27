/**
 * Settings merge utilities for Claude Code configuration.
 */

export interface HookConfig {
  type: "command" | "prompt";
  command?: string;
  prompt?: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher: string;
  hooks: HookConfig[];
}

export interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Stop?: HookMatcher[];
  SubagentStop?: HookMatcher[];
  UserPromptSubmit?: HookMatcher[];
  SessionStart?: HookMatcher[];
  SessionEnd?: HookMatcher[];
  PreCompact?: HookMatcher[];
  Notification?: HookMatcher[];
}

export interface SettingsJson {
  hooks?: HooksConfig;
  [key: string]: unknown;
}

type HookEvent = keyof HooksConfig;

/**
 * Deep merge two settings objects, intelligently combining hooks.
 *
 * - Hooks arrays are concatenated, not replaced
 * - Duplicate hooks (same matcher + command/prompt) are deduplicated
 * - User settings take precedence for non-hook fields
 */
export function mergeSettings(
  existing: SettingsJson,
  defaults: SettingsJson
): SettingsJson {
  const result: SettingsJson = { ...defaults, ...existing };

  // Merge hooks specially
  if (defaults.hooks || existing.hooks) {
    result.hooks = mergeHooks(existing.hooks ?? {}, defaults.hooks ?? {});
  }

  return result;
}

function mergeHooks(existing: HooksConfig, defaults: HooksConfig): HooksConfig {
  const result: HooksConfig = { ...existing };
  const events: HookEvent[] = [
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "SubagentStop",
    "UserPromptSubmit",
    "SessionStart",
    "SessionEnd",
    "PreCompact",
    "Notification",
  ];

  for (const event of events) {
    const existingHooks = existing[event] ?? [];
    const defaultHooks = defaults[event] ?? [];

    if (defaultHooks.length === 0) continue;

    // Combine and deduplicate
    const combined = [...existingHooks];

    for (const defaultMatcher of defaultHooks) {
      const existingMatcher = combined.find(
        (m) => m.matcher === defaultMatcher.matcher
      );

      if (existingMatcher) {
        // Merge hooks for same matcher, deduplicate
        for (const hook of defaultMatcher.hooks) {
          const isDuplicate = existingMatcher.hooks.some(
            (h) =>
              h.type === hook.type &&
              h.command === hook.command &&
              h.prompt === hook.prompt
          );
          if (!isDuplicate) {
            existingMatcher.hooks.push(hook);
          }
        }
      } else {
        combined.push(defaultMatcher);
      }
    }

    result[event] = combined;
  }

  return result;
}
