/**
 * Normalizes the `exports` field in package.json files.
 *
 * Three responsibilities:
 * 1. Alphabetize export keys to prevent non-deterministic ordering from causing
 *    spurious merge conflicts in stacked branches.
 * 2. Strip `./internal` and `./internal/*` exports as a safety net — these are
 *    implementation details that should never appear in the public surface.
 * 3. When called with `--stage <pkg...>`, normalize ALL packages (clean working
 *    tree) but only `git add` the package.json files for the listed packages.
 *    This keeps commits scoped to relevant changes while preventing drift from
 *    confusing agents and developers with a dirty working tree.
 *
 * Runs as a post-build step and in the pre-commit hook.
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

const INTERNAL_EXPORT_PREFIXES = ["./internal"];

function isInternalExport(key: string): boolean {
  return INTERNAL_EXPORT_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(`${prefix}/`)
  );
}

function sortExports(
  exports: Record<string, unknown>
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(exports).toSorted()) {
    if (isInternalExport(key)) {
      continue;
    }
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
  const args = Bun.argv.slice(2);
  const check = args.includes("--check");
  const stageIdx = args.indexOf("--stage");

  // --stage <pkg...>: normalize ALL packages (clean working tree) but only
  // git-add the package.json files for listed packages. This keeps commits
  // scoped while preventing drift from showing up as a dirty working tree.
  const stagePackages =
    stageIdx !== -1
      ? args.slice(stageIdx + 1).filter((a) => !a.startsWith("--"))
      : undefined;

  if (check && stageIdx !== -1) {
    console.warn(
      "[normalize-exports] --stage is ignored when --check is also set"
    );
  }

  const result = await normalizeWorkspaceExports({ write: !check });

  if (check) {
    if (result.changedPackages.length > 0) {
      console.error(
        `[normalize-exports] Export normalization needed in ${result.changedPackages.length} package(s):`
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
      `[normalize-exports] Normalized exports in ${result.changedPackages.length} package(s)`
    );
  }

  if (stagePackages !== undefined && result.changedPackages.length > 0) {
    const toStage = result.changedPackages.filter((pkg) =>
      stagePackages.some((sp) => pkg === sp)
    );

    if (toStage.length > 0) {
      const paths = toStage.map((pkg) => join(pkg, "package.json"));
      const { exitCode } = Bun.spawnSync(["git", "add", ...paths], {
        stdio: ["inherit", "inherit", "inherit"],
      });

      if (exitCode !== 0) {
        console.error(`[normalize-exports] git add failed (exit ${exitCode})`);
        process.exit(1);
      }

      console.log(
        `[normalize-exports] Staged ${toStage.length} package.json file(s)`
      );
    }
  }
}

if (import.meta.main) {
  await main();
}
