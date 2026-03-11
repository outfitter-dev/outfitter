/**
 * Managed workspace helpers for scaffold E2E runs.
 *
 * Runs live under a dedicated temp root so we can prune stale directories
 * without touching unrelated files in the system temp directory.
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const SCAFFOLD_E2E_ROOT_NAME = "outfitter-scaffold-e2e";
export const DEFAULT_SCAFFOLD_E2E_RETENTION_MS: number = 24 * 60 * 60 * 1000;

const RUN_DIR_NAME_PATTERN =
  /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})T(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})-(?<label>[a-z0-9-]+?)(?:-[0-9a-f-]+)?$/u;

export interface ScaffoldE2ERunInfo {
  readonly ageMs: number;
  readonly path: string;
}

export interface PruneScaffoldE2ERunsOptions {
  readonly maxAgeMs?: number;
  readonly now?: number;
  readonly removeAll?: boolean;
  readonly rootDir?: string;
}

export interface PruneScaffoldE2ERunsResult {
  readonly kept: readonly ScaffoldE2ERunInfo[];
  readonly removed: readonly ScaffoldE2ERunInfo[];
  readonly rootDir: string;
}

export interface CreateScaffoldE2ERunDirOptions {
  readonly now?: number;
  readonly rootDir?: string;
  readonly runLabel?: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatTimestamp(now: number): string {
  const date = new Date(now);
  return [
    date.getUTCFullYear().toString(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function slugifyLabel(label: string | undefined): string {
  const normalized = (label ?? "run")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized.length > 0 ? normalized : "run";
}

function parseRunStart(name: string): number | undefined {
  const match = RUN_DIR_NAME_PATTERN.exec(name);
  if (!match?.groups) {
    return undefined;
  }

  const { year, month, day, hour, minute, second } = match.groups as Record<
    string,
    string
  >;

  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

export function resolveScaffoldE2ERoot(rootDir?: string): string {
  return resolve(rootDir ?? join(tmpdir(), SCAFFOLD_E2E_ROOT_NAME));
}

export function createScaffoldE2ERunDir(
  options: CreateScaffoldE2ERunDirOptions = {}
): string {
  const rootDir = resolveScaffoldE2ERoot(options.rootDir);
  const timestamp = formatTimestamp(options.now ?? Date.now());
  const label = slugifyLabel(options.runLabel);
  const runId = Bun.randomUUIDv7().toLowerCase();
  const runDir = join(rootDir, `${timestamp}-${label}-${runId}`);

  mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function cleanupScaffoldE2ERunDir(runDir: string): void {
  if (existsSync(runDir)) {
    rmSync(runDir, { recursive: true, force: true });
  }
}

export function pruneScaffoldE2ERuns(
  options: PruneScaffoldE2ERunsOptions = {}
): PruneScaffoldE2ERunsResult {
  const rootDir = resolveScaffoldE2ERoot(options.rootDir);
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_SCAFFOLD_E2E_RETENTION_MS;
  const removed: ScaffoldE2ERunInfo[] = [];
  const kept: ScaffoldE2ERunInfo[] = [];

  if (!existsSync(rootDir)) {
    return { rootDir, removed, kept };
  }

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const startedAt = parseRunStart(entry.name);
    if (startedAt === undefined) {
      continue;
    }

    const path = join(rootDir, entry.name);
    const ageMs = Math.max(0, now - startedAt);
    const shouldRemove = options.removeAll === true || ageMs > maxAgeMs;

    if (shouldRemove) {
      cleanupScaffoldE2ERunDir(path);
      removed.push({ path, ageMs });
      continue;
    }

    kept.push({ path, ageMs });
  }

  return {
    rootDir,
    removed: removed.toSorted((left, right) =>
      left.path.localeCompare(right.path)
    ),
    kept: kept.toSorted((left, right) => left.path.localeCompare(right.path)),
  };
}
