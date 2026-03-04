/**
 * RFC 6570 Level 1 URI template matching.
 *
 * Extracts named variables from `{param}` segments and matches URIs
 * against templates used by MCP resource templates.
 *
 * @internal
 */

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a URI against a RFC 6570 Level 1 URI template.
 *
 * Extracts named variables from `{param}` segments.
 * Returns null if the URI doesn't match the template.
 */
export function matchUriTemplate(
  template: string,
  uri: string
): Record<string, string> | null {
  // Split template into literal segments and {param} placeholders,
  // escape literal segments to avoid regex metacharacter issues
  const paramNames: string[] = [];
  const parts = template.split(/(\{[^}]+\})/);
  const regexSource = parts
    .map((part) => {
      const paramMatch = part.match(/^\{([^}]+)\}$/);
      if (paramMatch?.[1]) {
        paramNames.push(paramMatch[1]);
        return "([^/]+)";
      }
      return escapeRegex(part);
    })
    .join("");

  const regex = new RegExp(`^${regexSource}$`);
  const match = uri.match(regex);

  if (!match) {
    return null;
  }

  const variables: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    const name = paramNames[i];
    const value = match[i + 1];
    if (name !== undefined && value !== undefined) {
      variables[name] = value;
    }
  }

  return variables;
}
