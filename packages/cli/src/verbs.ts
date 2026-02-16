/**
 * Command verb conventions for consistent CLI command naming.
 *
 * @packageDocumentation
 */

import type { CommandBuilder, VerbConfig, VerbFamily } from "./types.js";

/**
 * Built-in verb families with standard primary verbs and aliases.
 *
 * These follow POSIX and modern CLI conventions:
 * - `create` / `new` — Create a new resource
 * - `modify` / `edit` / `update` — Modify an existing resource
 * - `remove` / `delete` / `rm` — Remove a resource
 * - `list` / `ls` — List resources
 * - `show` / `get` / `view` — Show resource details
 */
export const VERB_FAMILIES: Readonly<Record<string, VerbFamily>> = {
  create: {
    primary: "create",
    aliases: ["new"],
    description: "Create a new resource",
  },
  modify: {
    primary: "modify",
    aliases: ["edit", "update"],
    description: "Modify a resource",
  },
  remove: {
    primary: "remove",
    aliases: ["delete", "rm"],
    description: "Remove a resource",
  },
  list: {
    primary: "list",
    aliases: ["ls"],
    description: "List resources",
  },
  show: {
    primary: "show",
    aliases: ["get", "view"],
    description: "Show details",
  },
};

/**
 * Resolve a verb family with optional project-level config overrides.
 *
 * @param family - Name of the verb family (e.g., "create", "modify")
 * @param config - Optional overrides for primary verb, aliases, etc.
 * @returns Resolved verb name and aliases
 *
 * @example
 * ```typescript
 * resolveVerb("modify"); // { name: "modify", aliases: ["edit", "update"] }
 * resolveVerb("modify", { primary: "edit" }); // { name: "edit", aliases: ["update"] }
 * resolveVerb("remove", { aliases: false }); // { name: "remove", aliases: [] }
 * ```
 */
export function resolveVerb(
  family: string,
  config?: VerbConfig
): { name: string; aliases: string[] } {
  const def = VERB_FAMILIES[family as keyof typeof VERB_FAMILIES];
  if (!Object.hasOwn(VERB_FAMILIES, family) || def === undefined) {
    throw new Error(`Unknown verb family: "${family}"`);
  }

  const name = config?.primary ?? def.primary;

  if (config?.aliases === false) {
    return { name, aliases: [] };
  }

  // Start with default aliases, removing the primary if it was promoted
  let aliases = [...def.aliases].filter((a) => a !== name);

  // Add extra aliases
  if (config?.extraAliases) {
    aliases.push(...config.extraAliases);
  }

  // Remove excluded aliases
  if (config?.excludeAliases) {
    const exclude = new Set(config.excludeAliases);
    aliases = aliases.filter((a) => !exclude.has(a));
  }

  // Deduplicate
  aliases = [...new Set(aliases)];

  return { name, aliases };
}

/**
 * Apply verb conventions to a CommandBuilder.
 *
 * Adds aliases from the resolved verb family to the command builder.
 *
 * @param builder - CommandBuilder to apply aliases to
 * @param family - Name of the verb family
 * @param config - Optional overrides
 * @returns The builder for chaining
 *
 * @example
 * ```typescript
 * const cmd = command("remove <id>")
 *   .description("Remove a resource");
 * applyVerb(cmd, "remove");
 * // Adds aliases: "delete", "rm"
 * ```
 */
export function applyVerb(
  builder: CommandBuilder,
  family: string,
  config?: VerbConfig
): CommandBuilder {
  const { aliases } = resolveVerb(family, config);
  for (const alias of aliases) {
    builder.alias(alias);
  }
  return builder;
}
