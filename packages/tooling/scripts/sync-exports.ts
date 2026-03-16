#!/usr/bin/env bun
/**
 * Generates config-file exports in package.json from the `files` array.
 *
 * Any file in `files` with a config extension (.json, .jsonc, .yml, .yaml, .toml)
 * gets two exports: the full filename and an extensionless short alias.
 *
 * Short alias rules:
 *   .oxlintrc.json           → ./.oxlintrc
 *   tsconfig.preset.json     → ./tsconfig
 *   tsconfig.preset.bun.json → ./tsconfig-bun
 *   lefthook.yml             → ./lefthook
 *   .markdownlint-cli2.jsonc → ./.markdownlint-cli2
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_EXTENSIONS = /\.(json|jsonc|yml|yaml|toml)$/;
const CHECK_FLAG = "--check";

type PackageJsonLike = {
  files?: string[];
  exports?: Record<string, unknown>;
};

export function shortAlias(filename: string): string {
  // Strip extension
  let base = filename.replace(CONFIG_EXTENSIONS, "");

  // Handle .preset.variant → name-variant
  const match = base.match(/^(.+)\.preset(?:\.(.+))?$/);
  if (match) {
    const presetName = match[1];
    if (presetName) {
      base = match[2] ? `${presetName}-${match[2]}` : presetName;
    }
  }

  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configFilesFrom(files: string[] | undefined): string[] {
  return (files ?? []).filter(
    (file) => CONFIG_EXTENSIONS.test(file) && file !== "package.json"
  );
}

export function sortExports(
  exportsMap: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(exportsMap).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}

export function buildSyncedExports(
  pkg: PackageJsonLike
): Record<string, unknown> {
  const configFiles = configFilesFrom(pkg.files);
  const configPaths = new Set(
    configFiles.flatMap((file) => [`./${file}`, `./${shortAlias(file)}`])
  );

  const reconciledExports: Record<string, unknown> = {};
  const currentExports = isRecord(pkg.exports) ? pkg.exports : {};

  for (const [key, value] of Object.entries(currentExports)) {
    if (!configPaths.has(key)) {
      reconciledExports[key] = value;
    }
  }

  for (const file of configFiles) {
    const alias = shortAlias(file);
    reconciledExports[`./${alias}`] = `./${file}`;
    if (alias !== file) {
      reconciledExports[`./${file}`] = `./${file}`;
    }
  }

  return sortExports(reconciledExports);
}

export type SyncExportsPlan =
  | "check_failed"
  | "format_only"
  | "up_to_date"
  | "write_and_format";

export function planSyncExports(options: {
  currentExports: Record<string, unknown>;
  nextExports: Record<string, unknown>;
  isCheckMode: boolean;
}): SyncExportsPlan {
  const hasExportDrift =
    JSON.stringify(options.currentExports) !==
    JSON.stringify(options.nextExports);

  if (!hasExportDrift) {
    return options.isCheckMode ? "up_to_date" : "format_only";
  }

  return options.isCheckMode ? "check_failed" : "write_and_format";
}

if (import.meta.main) {
  const isCheckMode = Bun.argv.includes(CHECK_FLAG);
  const pkgPath = join(import.meta.dirname, "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonLike;
  const currentExports = isRecord(pkg.exports) ? pkg.exports : {};
  const nextExports = buildSyncedExports(pkg);
  const configFiles = configFilesFrom(pkg.files);
  const plan = planSyncExports({ currentExports, nextExports, isCheckMode });

  if (plan === "up_to_date") {
    console.log(
      `[sync-exports] exports are up to date (${configFiles.length} config files)`
    );
    process.exit(0);
  }

  if (plan === "check_failed") {
    console.error(
      "[sync-exports] exports are out of sync. Run: bun run --filter @outfitter/tooling sync:exports"
    );
    process.exit(1);
  }

  if (plan === "write_and_format") {
    pkg.exports = nextExports;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
  }

  // Run oxfmt to ensure the output survives a format round-trip.
  // Non-check mode always runs this step so a prior formatter failure can
  // self-heal even when the exports map is already structurally in sync.
  const fmtResult = Bun.spawnSync(["bun", "x", "oxfmt", pkgPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (fmtResult.exitCode !== 0) {
    const stderr = fmtResult.stderr.toString().trim();
    const code =
      fmtResult.exitCode ?? `signal ${fmtResult.signalCode ?? "unknown"}`;
    console.error(
      `[sync-exports] oxfmt post-format failed (${code})${stderr ? `:\n${stderr}` : ""}`
    );
    process.exit(1);
  }

  if (plan === "format_only") {
    console.log(
      `[sync-exports] exports are structurally up to date (${configFiles.length} config files); re-applied oxfmt for format convergence`
    );
    process.exit(0);
  }

  console.log(
    `[sync-exports] wrote ${Object.keys(nextExports).length} exports (${configFiles.length} config files)`
  );
}
