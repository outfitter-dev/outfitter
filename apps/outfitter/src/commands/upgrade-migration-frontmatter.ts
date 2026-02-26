/**
 * Structured migration doc frontmatter parsing for `outfitter upgrade`.
 *
 * @packageDocumentation
 */

/** Classification of a change within a migration. */
export type MigrationChangeType =
  | "renamed"
  | "removed"
  | "signature-changed"
  | "moved"
  | "deprecated"
  | "added";

/** A single structured change entry from migration frontmatter. */
export interface MigrationChange {
  /** Path to codemod script relative to the codemods directory. */
  readonly codemod?: string;
  readonly detail?: string;
  readonly export?: string;
  readonly from?: string;
  readonly path?: string;
  readonly to?: string;
  readonly type: MigrationChangeType;
}

/** Parsed frontmatter from a migration doc. */
export interface MigrationFrontmatter {
  readonly breaking: boolean;
  readonly changes?: readonly MigrationChange[];
  readonly package: string;
  readonly version: string;
}

const FRONTMATTER_BLOCK_REGEX = /^---\r?\n[\s\S]*?\r?\n---\r?\n*/;

const VALID_CHANGE_TYPES = new Set<MigrationChangeType>([
  "renamed",
  "removed",
  "signature-changed",
  "moved",
  "deprecated",
  "added",
]);

/**
 * Strip a YAML frontmatter block from migration doc content.
 */
export function stripMigrationFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_BLOCK_REGEX, "").trim();
}

/**
 * Parse a YAML value, stripping optional surrounding quotes.
 */
function parseYamlValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the full frontmatter from a migration doc, including the `changes` array.
 *
 * Returns `null` if the content has no valid frontmatter or is missing
 * required fields (`package`, `version`, `breaking`).
 */
export function parseMigrationFrontmatter(
  content: string
): MigrationFrontmatter | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch?.[1]) return null;

  const fmBlock = fmMatch[1];
  const lines = fmBlock.split(/\r?\n/);

  // Parse top-level scalar fields
  let pkg: string | undefined;
  let version: string | undefined;
  let breaking: boolean | undefined;

  // Track where the changes array starts
  let changesStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trimStart();

    if (trimmed.startsWith("package:")) {
      pkg = parseYamlValue(trimmed.slice("package:".length));
    } else if (trimmed.startsWith("version:")) {
      version = parseYamlValue(trimmed.slice("version:".length));
    } else if (trimmed.startsWith("breaking:")) {
      const val = parseYamlValue(trimmed.slice("breaking:".length));
      if (val === "true") breaking = true;
      else if (val === "false") breaking = false;
    } else if (trimmed.startsWith("changes:")) {
      changesStartIdx = i + 1;
    }
  }

  if (pkg === undefined || version === undefined || breaking === undefined) {
    return null;
  }

  // Parse changes array if present
  let changes: MigrationChange[] | undefined;
  if (changesStartIdx >= 0) {
    changes = parseChangesArray(lines, changesStartIdx);
  }

  return {
    package: pkg,
    version,
    breaking,
    ...(changes !== undefined ? { changes } : {}),
  };
}

/**
 * Parse the YAML `changes` array from frontmatter lines starting at `startIdx`.
 *
 * Each item begins with `  - type: ...` and may have additional key/value pairs
 * indented under it.
 */
function parseChangesArray(
  lines: string[],
  startIdx: number
): MigrationChange[] {
  const changes: MigrationChange[] = [];
  let current: Record<string, string> | null = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // New list item: starts with "  - "
    if (/^\s+-\s+/.test(line)) {
      if (current !== null) {
        const change = buildChange(current);
        if (change) changes.push(change);
      }
      current = {};
      // Parse the key/value on the same line as the dash
      const afterDash = line.replace(/^\s+-\s+/, "");
      const colonIdx = afterDash.indexOf(":");
      if (colonIdx >= 0) {
        const key = afterDash.slice(0, colonIdx).trim();
        const val = parseYamlValue(afterDash.slice(colonIdx + 1));
        current[key] = val;
      }
    } else if (current !== null && /^\s{4,}\S/.test(line)) {
      // Continuation line for current item (indented further)
      const trimmed = line.trim();
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx >= 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = parseYamlValue(trimmed.slice(colonIdx + 1));
        current[key] = val;
      }
    } else if (/^\S/.test(line)) {
      // Non-indented line means we've left the changes block
      break;
    }
  }

  // Flush last item
  if (current !== null) {
    const change = buildChange(current);
    if (change) changes.push(change);
  }

  return changes;
}

/**
 * Build a MigrationChange from a parsed key/value map.
 */
function buildChange(raw: Record<string, string>): MigrationChange | null {
  const type = raw["type"];
  if (!(type && VALID_CHANGE_TYPES.has(type as MigrationChangeType))) {
    return null;
  }

  return {
    type: type as MigrationChangeType,
    ...(raw["from"] ? { from: raw["from"] } : {}),
    ...(raw["to"] ? { to: raw["to"] } : {}),
    ...(raw["path"] ? { path: raw["path"] } : {}),
    ...(raw["export"] ? { export: raw["export"] } : {}),
    ...(raw["detail"] ? { detail: raw["detail"] } : {}),
    ...(raw["codemod"] ? { codemod: raw["codemod"] } : {}),
  };
}
