/**
 * Shared jq filtering utility for CLI commands.
 *
 * @packageDocumentation
 */

/**
 * Apply a jq expression to JSON data using the system `jq` binary.
 *
 * @param data - Data to filter
 * @param expr - jq expression
 * @param options - jq output controls
 * @returns Filtered output string, or the original JSON if jq fails
 */
export async function applyJq(
  data: unknown,
  expr: string,
  options?: { compact?: boolean }
): Promise<string> {
  try {
    const json = JSON.stringify(data);
    const args = ["jq", ...(options?.compact ? ["-c"] : []), expr];
    const proc = Bun.spawn(args, {
      stdin: new Response(json),
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      process.stderr.write(`jq error: ${stderr.trim()}\n`);
      return options?.compact
        ? `${JSON.stringify(data)}\n`
        : `${JSON.stringify(data, null, 2)}\n`;
    }

    return stdout;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown jq execution error";
    const missingBinary = /enoent|not found/i.test(message);
    if (missingBinary) {
      process.stderr.write(
        "jq is not installed. Install jq or omit --jq to continue.\n"
      );
    } else {
      process.stderr.write(`jq execution error: ${message}\n`);
    }
    return options?.compact
      ? `${JSON.stringify(data)}\n`
      : `${JSON.stringify(data, null, 2)}\n`;
  }
}
