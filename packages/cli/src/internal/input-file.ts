/** Async file and glob input expansion. @internal */

import path from "node:path";

import type { ExpandFileOptions, ParseGlobOptions } from "../types.js";
import { isDirectory, isFile, readStdin } from "./input-helpers.js";
import {
  isSecureGlobPattern,
  isSecurePath,
  isWithinWorkspace,
} from "./input-security.js";

// =============================================================================
// expandFileArg()
// =============================================================================

/**
 * Expand @file references to file contents.
 *
 * If the input starts with @, reads the file and returns its contents.
 * Otherwise, returns the input unchanged.
 *
 * @param input - Raw input that may be a @file reference
 * @param options - Expansion options
 * @returns File contents or original input
 *
 * @example
 * ```typescript
 * // wm create @template.md
 * const content = await expandFileArg(args.content);
 * ```
 */
export async function expandFileArg(
  input: string,
  options?: ExpandFileOptions
): Promise<string> {
  const {
    encoding: _encoding = "utf-8",
    maxSize,
    trim = false,
  } = options ?? {};

  // Not a file reference - return as-is
  if (!input.startsWith("@")) {
    return input;
  }

  const filePath = input.slice(1);

  // @- means stdin
  if (filePath === "-") {
    let content = await readStdin();
    if (trim) {
      content = content.trim();
    }
    return content;
  }

  // Security: validate path doesn't contain traversal patterns
  if (!isSecurePath(filePath, true)) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: path traversal security check
    throw new Error(`Security error: path traversal not allowed: ${filePath}`);
  }

  // Read file
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: file must exist
    throw new Error(`File not found: ${filePath}`);
  }

  // Check size limit before reading
  if (maxSize !== undefined) {
    const size = file.size;
    if (size > maxSize) {
      // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: file size security check
      throw new Error(`File exceeds maximum size of ${maxSize} bytes`);
    }
  }

  // Read file content - Bun.file.text() always uses UTF-8
  let content = await file.text();

  if (trim) {
    content = content.trim();
  }

  return content;
}

// =============================================================================
// parseGlob()
// =============================================================================

/**
 * Parse and expand glob patterns.
 *
 * Uses Bun.Glob with workspace constraints.
 *
 * @param pattern - Glob pattern to expand
 * @param options - Glob options
 * @returns Array of matched file paths
 *
 * @example
 * ```typescript
 * // wm index "src/**\/*.ts"
 * const files = await parseGlob(args.pattern, {
 *   cwd: workspaceRoot,
 *   ignore: ["node_modules/**"],
 * });
 * ```
 */
export async function parseGlob(
  pattern: string,
  options?: ParseGlobOptions
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    ignore = [],
    onlyFiles = false,
    onlyDirectories = false,
    followSymlinks = false,
  } = options ?? {};

  // Security: validate pattern doesn't escape workspace
  if (!isSecureGlobPattern(pattern)) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: glob pattern security check
    throw new Error(
      `Security error: glob pattern may escape workspace: ${pattern}`
    );
  }

  // Resolve workspace root for boundary checking
  const resolvedCwd = path.resolve(cwd);

  const glob = new Bun.Glob(pattern);
  const matches: string[] = [];

  // Scan with options
  // Only set onlyFiles when explicitly requested (not as default)
  const scanOptions = {
    cwd,
    followSymlinks,
    onlyFiles: onlyFiles === true,
  };

  for await (const match of glob.scan(scanOptions)) {
    // Resolve absolute path for workspace boundary check
    const fullPath = path.resolve(cwd, match);

    // Security: verify match is within workspace
    if (!isWithinWorkspace(fullPath, resolvedCwd)) {
      continue;
    }

    // Check against ignore patterns
    let shouldIgnore = false;
    for (const ignorePattern of ignore) {
      const ignoreGlob = new Bun.Glob(ignorePattern);
      if (ignoreGlob.match(match)) {
        shouldIgnore = true;
        break;
      }
    }

    if (shouldIgnore) continue;

    // If onlyDirectories, check if it's a directory
    if (onlyDirectories) {
      const isDir = await isDirectory(fullPath);
      if (!isDir) continue;
    }

    // If onlyFiles, check if it's a file
    if (onlyFiles) {
      const isF = await isFile(fullPath);
      if (!isF) continue;
    }

    matches.push(match);
  }

  return matches;
}
