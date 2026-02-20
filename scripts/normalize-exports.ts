/**
 * Normalizes the `exports` field in package.json files to alphabetical key order.
 *
 * Bunup auto-generates exports from filesystem discovery, which produces
 * non-deterministic key ordering. This causes spurious merge conflicts in
 * stacked branches where the semantic exports are identical but key order differs.
 *
 * Runs as a post-build step after bunup writes exports.
 */

import { resolve } from "node:path";

/** Auto-discover workspace packages from root package.json workspace globs */
async function discoverWorkspaceRoots(): Promise<string[]> {
  const rootPkg = await Bun.file("package.json").json();
  const workspaces: string[] = rootPkg.workspaces ?? [];
  const roots: string[] = [];

  for (const pattern of workspaces) {
    const glob = new Bun.Glob(`${pattern}/package.json`);
    for await (const match of glob.scan({ dot: false })) {
      roots.push(match.replace("/package.json", ""));
    }
  }

  return roots.sort();
}

const WORKSPACE_ROOTS = await discoverWorkspaceRoots();

function sortExports(
  exports: Record<string, unknown>
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(exports).sort()) {
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

let changed = 0;

for (const root of WORKSPACE_ROOTS) {
  const pkgPath = resolve(root, "package.json");
  const file = Bun.file(pkgPath);

  if (!(await file.exists())) continue;

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

  pkg.exports = sorted;
  await Bun.write(pkgPath, `${JSON.stringify(pkg, null, indent)}\n`);
  changed += 1;
}

if (changed > 0) {
  console.log(`[normalize-exports] Sorted exports in ${changed} package(s)`);
}
