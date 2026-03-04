/**
 * Basic I/O and validation helpers for CLI input.
 *
 * @internal
 */

/**
 * Reads stdin content using async iteration.
 */
export async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    if (typeof chunk === "string") {
      chunks.push(chunk);
    } else if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk.toString("utf-8"));
    } else if (chunk instanceof Uint8Array) {
      // Convert Uint8Array to Buffer then to string
      chunks.push(Buffer.from(chunk).toString("utf-8"));
    }
  }
  return chunks.join("");
}

/**
 * Splits a string by comma and/or space, trimming each part.
 */
export function splitIds(input: string): string[] {
  // Split on commas first, then on spaces within each part
  return input
    .split(",")
    .flatMap((part) => part.trim().split(/\s+/))
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Checks if a path is a directory using Bun shell.
 */
export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    // Use Bun shell to check if directory
    const result = await Bun.$`test -d ${dirPath}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Checks if a path is a file using Bun shell.
 */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    // Use Bun shell to check if file
    const result = await Bun.$`test -f ${filePath}`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
