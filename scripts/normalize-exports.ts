/**
 * Normalizes the `exports` field in package.json files to alphabetical key order.
 *
 * Bunup auto-generates exports from filesystem discovery, which produces
 * non-deterministic key ordering. This causes spurious merge conflicts in
 * stacked branches where the semantic exports are identical but key order differs.
 *
 * Runs as a post-build step after bunup writes exports.
 */

import { join, resolve } from "node:path";

interface RootPackageJson {
  workspaces?: string[];
}

interface NormalizeWorkspaceExportsInput {
  cwd?: string;
  write?: boolean;
}

interface NormalizeWorkspaceExportsOutput {
  changedPackages: string[];
}

/** Auto-discover workspace packages from root package.json workspace globs */
async function discoverWorkspaceRoots(cwd: string): Promise<string[]> {
  const rootPkg = (await Bun.file(
    join(cwd, "package.json")
  ).json()) as RootPackageJson;
  const workspaces: string[] = rootPkg.workspaces ?? [];
  const roots: string[] = [];

  for (const pattern of workspaces) {
    const glob = new Bun.Glob(`${pattern}/package.json`);
    for await (const match of glob.scan({ cwd, dot: false })) {
      roots.push(match.replace("/package.json", ""));
    }
  }

  return roots.toSorted();
}

function sortExports(
  exports: Record<string, unknown>
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(exports).toSorted()) {
    sorted[key] = exports[key];
  }
  return sorted;
}

function addConfigFileExports(
  exportsMap: Record<string, unknown>,
  files: readonly string[] | undefined
): void {
  const CONFIG_RE = /\.(json|jsonc|yml|yaml|toml)$/;

  for (const file of files ?? []) {
    if (!CONFIG_RE.test(file) || file === "package.json") {
      continue;
    }

    exportsMap[`./${file}`] = `./${file}`;

    let alias = file.replace(CONFIG_RE, "");
    const presetMatch = alias.match(/^(.+)\.preset(?:\.(.+))?$/);
    if (presetMatch?.[1]) {
      alias = presetMatch[2]
        ? `${presetMatch[1]}-${presetMatch[2]}`
        : presetMatch[1];
    }

    if (alias !== file) {
      exportsMap[`./${alias}`] = `./${file}`;
    }
  }
}

/** Detect indentation from file content (tab vs spaces) */
function detectIndent(content: string): string {
  const match = content.match(/^(\s+)"/m);
  return match?.[1] ?? "  ";
}

export async function normalizeWorkspaceExports(
  input: NormalizeWorkspaceExportsInput = {}
): Promise<NormalizeWorkspaceExportsOutput> {
  const cwd = resolve(input.cwd ?? process.cwd());
  const write = input.write ?? true;
  const workspaceRoots = await discoverWorkspaceRoots(cwd);
  const changedPackages: string[] = [];

  for (const root of workspaceRoots) {
    const pkgPath = resolve(cwd, root, "package.json");
    const file = Bun.file(pkgPath);

    if (!(await file.exists())) {
      continue;
    }

    const content = await file.text();
    const indent = detectIndent(content);
    const pkg = JSON.parse(content) as Record<string, unknown>;

    if (
      !pkg.exports ||
      typeof pkg.exports !== "object" ||
      Array.isArray(pkg.exports)
    ) {
      continue;
    }

    const exportsWithConfigs = {
      ...(pkg.exports as Record<string, unknown>),
    };
    addConfigFileExports(exportsWithConfigs, pkg.files as string[] | undefined);
    exportsWithConfigs["./package.json"] = "./package.json";

    const sorted = sortExports(exportsWithConfigs);
    const currentExportsJson = JSON.stringify(pkg.exports);
    const sortedExportsJson = JSON.stringify(sorted);

    if (currentExportsJson === sortedExportsJson) {
      continue;
    }

    changedPackages.push(root);
    if (!write) {
      continue;
    }

    pkg.exports = sorted;
    await Bun.write(pkgPath, `${JSON.stringify(pkg, null, indent)}\n`);
  }

  return { changedPackages };
}

async function main(): Promise<void> {
  const check = Bun.argv.includes("--check");
  const result = await normalizeWorkspaceExports({ write: !check });

  if (check) {
    if (result.changedPackages.length > 0) {
      console.error(
        `[normalize-exports] Export ordering drift in ${result.changedPackages.length} package(s):`
      );
      for (const pkg of result.changedPackages) {
        console.error(`  - ${pkg}`);
      }
      console.error("\nRun `bun scripts/normalize-exports.ts` to fix.");
      process.exit(1);
    }
    console.log("[normalize-exports] All exports are normalized.");
    return;
  }

  if (result.changedPackages.length > 0) {
    console.log(
      `[normalize-exports] Sorted exports in ${result.changedPackages.length} package(s)`
    );
  }
}

if (import.meta.main) {
  await main();
}
