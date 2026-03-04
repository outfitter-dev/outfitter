import { join, relative } from "node:path";

import { InternalError, Result } from "@outfitter/contracts";

import type { GlobOptions } from "./types.js";

/**
 * Processes ignore patterns, handling negation patterns.
 * Returns a filtering function that determines if a file should be included.
 */
function createIgnoreFilter(
  ignore: string[] | undefined,
  cwd: string
): (filePath: string) => boolean {
  if (!ignore || ignore.length === 0) {
    return () => true; // Include all files
  }

  // Separate regular ignore patterns from negation patterns
  const ignorePatterns: string[] = [];
  const negationPatterns: string[] = [];

  for (const pattern of ignore) {
    if (pattern.startsWith("!")) {
      negationPatterns.push(pattern.slice(1));
    } else {
      ignorePatterns.push(pattern);
    }
  }

  return (filePath: string) => {
    // Get relative path for pattern matching
    const relativePath = relative(cwd, filePath);

    // Check if file matches any ignore pattern
    let isIgnored = false;
    for (const pattern of ignorePatterns) {
      const glob = new Bun.Glob(pattern);
      if (glob.match(relativePath)) {
        isIgnored = true;
        break;
      }
    }

    // If ignored, check if it matches any negation pattern (to un-ignore)
    if (isIgnored) {
      for (const pattern of negationPatterns) {
        const glob = new Bun.Glob(pattern);
        if (glob.match(relativePath)) {
          isIgnored = false;
          break;
        }
      }
    }

    return !isIgnored;
  };
}

/**
 * Finds files matching a glob pattern.
 *
 * Uses Bun.Glob internally for fast pattern matching. Returns absolute paths.
 * Supports standard glob syntax including recursive matching, alternation, and character classes.
 *
 * Pattern syntax:
 * - Single asterisk matches any characters except path separator
 * - Double asterisk matches any characters including path separator (recursive)
 * - Curly braces for alternation
 * - Square brackets for character classes
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options including cwd, ignore patterns, and file type filters
 * @returns Result containing array of absolute file paths, or InternalError on failure
 */
export async function glob(
  pattern: string,
  options?: GlobOptions
): Promise<Result<string[], InstanceType<typeof InternalError>>> {
  try {
    const cwd = options?.cwd ?? process.cwd();
    const bunGlob = new Bun.Glob(pattern);

    const files: string[] = [];
    const ignoreFilter = createIgnoreFilter(options?.ignore, cwd);

    // Use conditional spread for optional boolean properties (exactOptionalPropertyTypes)
    const scanOptions = {
      cwd,
      ...(options?.dot !== undefined && { dot: options.dot }),
      ...(options?.followSymlinks !== undefined && {
        followSymlinks: options.followSymlinks,
      }),
    };

    for await (const file of bunGlob.scan(scanOptions)) {
      const absolutePath = join(cwd, file);
      if (ignoreFilter(absolutePath)) {
        files.push(absolutePath);
      }
    }

    return Result.ok(files);
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Glob operation failed",
      })
    );
  }
}

/**
 * Synchronous version of glob.
 *
 * Use the async glob function when possible. This synchronous version
 * blocks the event loop and should only be used in initialization code
 * or synchronous contexts.
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options including cwd, ignore patterns, and file type filters
 * @returns Result containing array of absolute file paths, or InternalError on failure
 */
export function globSync(
  pattern: string,
  options?: GlobOptions
): Result<string[], InstanceType<typeof InternalError>> {
  try {
    const cwd = options?.cwd ?? process.cwd();
    const bunGlob = new Bun.Glob(pattern);

    const files: string[] = [];
    const ignoreFilter = createIgnoreFilter(options?.ignore, cwd);

    // Use conditional spread for optional boolean properties (exactOptionalPropertyTypes)
    const scanOptions = {
      cwd,
      ...(options?.dot !== undefined && { dot: options.dot }),
      ...(options?.followSymlinks !== undefined && {
        followSymlinks: options.followSymlinks,
      }),
    };

    for (const file of bunGlob.scanSync(scanOptions)) {
      const absolutePath = join(cwd, file);
      if (ignoreFilter(absolutePath)) {
        files.push(absolutePath);
      }
    }

    return Result.ok(files);
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Glob operation failed",
      })
    );
  }
}
