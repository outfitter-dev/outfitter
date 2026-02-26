/**
 * Query npm registry for the latest version of a package.
 *
 * @param name - Full npm package name (e.g. "@outfitter/cli")
 * @returns Trimmed version string, or `null` if the lookup fails or returns empty
 */
export async function getLatestVersion(name: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["npm", "view", name, "version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return null;
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
