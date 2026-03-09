/**
 * CI-focused test runner with explicit Turbo/Bun concurrency and diagnostics.
 *
 * @packageDocumentation
 */

import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

type TurboLogOrder = "auto" | "stream" | "grouped";
type TurboOutputLogs =
  | "full"
  | "none"
  | "hash-only"
  | "new-only"
  | "errors-only";

interface ResolveCiTestRunnerConfigOptions {
  readonly cwd: string;
  readonly env?: Record<string, string | undefined>;
  readonly now?: Date;
}

export interface CiTestRunnerConfig {
  readonly bunMaxConcurrency: number;
  readonly diagnosticsDir: string;
  readonly filters: readonly string[];
  readonly logOrder: TurboLogOrder;
  readonly outputLogs: TurboOutputLogs;
  readonly rootDir: string;
  readonly runId: string;
  readonly shard: string | null;
  readonly turboConcurrency: number;
}

interface TurboCommandOptions {
  readonly bunMaxConcurrency: number;
  readonly filters: readonly string[];
  readonly logOrder: TurboLogOrder;
  readonly outputLogs: TurboOutputLogs;
  readonly turboConcurrency: number;
}

interface CiRunMetadata {
  readonly $schema: "https://outfitter.dev/reports/ci-tests/v1";
  readonly artifacts: {
    readonly log: string;
    readonly turboSummary: string | null;
  };
  readonly command: readonly string[];
  readonly durationMs: number;
  readonly environment: {
    readonly bunMaxConcurrency: number;
    readonly logOrder: TurboLogOrder;
    readonly outputLogs: TurboOutputLogs;
    readonly turboConcurrency: number;
  };
  readonly exitCode: number;
  readonly filters: readonly string[];
  readonly finishedAt: string;
  readonly github: {
    readonly attempt: string | null;
    readonly runId: string | null;
    readonly sha: string | null;
  };
  readonly runId: string;
  readonly shard: string | null;
  readonly startedAt: string;
  readonly status: "failed" | "passed";
}

const DEFAULT_TURBO_CONCURRENCY = 2;
const DEFAULT_BUN_MAX_CONCURRENCY = 4;
const DEFAULT_LOG_ORDER: TurboLogOrder = "stream";
const DEFAULT_OUTPUT_LOGS: TurboOutputLogs = "full";

function isTurboLogOrder(value: string): value is TurboLogOrder {
  return value === "auto" || value === "stream" || value === "grouped";
}

function isTurboOutputLogs(value: string): value is TurboOutputLogs {
  return (
    value === "full" ||
    value === "none" ||
    value === "hash-only" ||
    value === "new-only" ||
    value === "errors-only"
  );
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  minimum = 1
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function isoRunStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\./g, "");
}

function resolveRunId(
  env: Record<string, string | undefined>,
  now: Date
): string {
  const explicitRunId = env["OUTFITTER_CI_RUN_ID"];
  if (explicitRunId && explicitRunId.trim().length > 0) {
    return explicitRunId.trim();
  }

  const run = env["GITHUB_RUN_ID"];
  const attempt = env["GITHUB_RUN_ATTEMPT"];
  const stamp = isoRunStamp(now);
  if (run && attempt) {
    return `gha-${run}-${attempt}-${stamp}`;
  }
  return `local-${stamp}`;
}

export function resolveCiTestRunnerConfig(
  options: ResolveCiTestRunnerConfigOptions
): CiTestRunnerConfig {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const rootDir = resolve(options.cwd);
  const diagnosticsDir = join(rootDir, ".outfitter", "reports", "ci");

  const logOrderRaw = env["OUTFITTER_CI_TURBO_LOG_ORDER"];
  const outputLogsRaw = env["OUTFITTER_CI_TURBO_OUTPUT_LOGS"];
  const filterRaw = env["OUTFITTER_CI_TEST_FILTER"];
  const shardRaw = env["OUTFITTER_CI_TEST_SHARD"];

  const filters = filterRaw
    ? filterRaw
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    : [];

  return {
    rootDir,
    diagnosticsDir,
    filters,
    runId: resolveRunId(env, now),
    shard: shardRaw?.trim() || null,
    turboConcurrency: parsePositiveInt(
      env["OUTFITTER_CI_TURBO_CONCURRENCY"],
      DEFAULT_TURBO_CONCURRENCY
    ),
    bunMaxConcurrency: parsePositiveInt(
      env["OUTFITTER_CI_BUN_MAX_CONCURRENCY"],
      DEFAULT_BUN_MAX_CONCURRENCY
    ),
    logOrder:
      logOrderRaw && isTurboLogOrder(logOrderRaw)
        ? logOrderRaw
        : DEFAULT_LOG_ORDER,
    outputLogs:
      outputLogsRaw && isTurboOutputLogs(outputLogsRaw)
        ? outputLogsRaw
        : DEFAULT_OUTPUT_LOGS,
  };
}

export function buildTurboCiTestCommand(
  options: TurboCommandOptions
): readonly string[] {
  const filterFlags = options.filters.flatMap((f) => ["--filter", f]);

  return [
    "bun",
    "x",
    "turbo",
    "run",
    "test",
    ...filterFlags,
    "--no-daemon",
    "--only",
    "--concurrency",
    String(options.turboConcurrency),
    "--output-logs",
    options.outputLogs,
    "--log-order",
    options.logOrder,
    "--log-prefix",
    "task",
    "--summarize",
    "--",
    "--max-concurrency",
    String(options.bunMaxConcurrency),
  ];
}

function listTurboRunSummaries(rootDir: string): string[] {
  const runsDir = join(rootDir, ".turbo", "runs");
  if (!existsSync(runsDir)) {
    return [];
  }
  return readdirSync(runsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => join(runsDir, file));
}

function findNewestPath(paths: readonly string[]): string | undefined {
  if (paths.length === 0) return undefined;
  return [...paths].toSorted(
    (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs
  )[0];
}

function findNewTurboSummary(
  rootDir: string,
  beforeRun: ReadonlySet<string>
): string | undefined {
  const afterRun = listTurboRunSummaries(rootDir);
  const fresh = afterRun.filter((path) => !beforeRun.has(path));
  if (fresh.length > 0) {
    return findNewestPath(fresh);
  }
  return findNewestPath(afterRun);
}

function writeMetadata(path: string, metadata: CiRunMetadata): void {
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
}

async function mirrorStreamToOutputs(
  stream: ReadableStream<Uint8Array> | null,
  destination: NodeJS.WriteStream,
  logSink: ReturnType<typeof createWriteStream>
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      destination.write(value);
      logSink.write(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function logStart(
  config: CiTestRunnerConfig,
  command: readonly string[]
): void {
  const logLines = [
    "[ci-test-runner] Starting CI test run",
    `[ci-test-runner] runId=${config.runId}`,
    `[ci-test-runner] turboConcurrency=${config.turboConcurrency}`,
    `[ci-test-runner] bunMaxConcurrency=${config.bunMaxConcurrency}`,
    `[ci-test-runner] turboLogOrder=${config.logOrder}`,
    `[ci-test-runner] turboOutputLogs=${config.outputLogs}`,
  ];
  if (config.shard) {
    logLines.push(`[ci-test-runner] shard=${config.shard}`);
  }
  if (config.filters.length > 0) {
    logLines.push(`[ci-test-runner] filters=${config.filters.join(",")}`);
  }
  logLines.push(`[ci-test-runner] command=${command.join(" ")}`);
  process.stdout.write(logLines.join("\n") + "\n");
}

export async function runCiTests(config: CiTestRunnerConfig): Promise<{
  readonly exitCode: number;
  readonly logPath: string;
  readonly metadataPath: string;
  readonly summaryArtifactPath: string | null;
}> {
  mkdirSync(config.diagnosticsDir, { recursive: true });

  const command = buildTurboCiTestCommand({
    bunMaxConcurrency: config.bunMaxConcurrency,
    filters: config.filters,
    logOrder: config.logOrder,
    outputLogs: config.outputLogs,
    turboConcurrency: config.turboConcurrency,
  });
  const startedAt = new Date();
  const startedAtMs = Date.now();
  const beforeRun = new Set(listTurboRunSummaries(config.rootDir));

  const logPath = join(config.diagnosticsDir, `test-run-${config.runId}.log`);
  const metadataPath = join(
    config.diagnosticsDir,
    `test-run-${config.runId}.json`
  );
  const summaryArtifactPath = join(
    config.diagnosticsDir,
    `turbo-summary-${config.runId}.json`
  );
  const logSink = createWriteStream(logPath, { flags: "a" });

  logStart(config, command);
  logSink.write(
    [
      `runId=${config.runId}`,
      `startedAt=${startedAt.toISOString()}`,
      `command=${command.join(" ")}`,
      "",
    ].join("\n")
  );

  const handle = Bun.spawn([...command], {
    cwd: config.rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode] = await Promise.all([
    handle.exited,
    mirrorStreamToOutputs(handle.stdout, process.stdout, logSink),
    mirrorStreamToOutputs(handle.stderr, process.stderr, logSink),
  ]);

  const finishedAt = new Date();
  const durationMs = Date.now() - startedAtMs;

  const turboSummary = findNewTurboSummary(config.rootDir, beforeRun);
  let copiedTurboSummaryPath: string | null = null;
  if (turboSummary) {
    copyFileSync(turboSummary, summaryArtifactPath);
    copiedTurboSummaryPath = summaryArtifactPath;
  }

  const metadata: CiRunMetadata = {
    $schema: "https://outfitter.dev/reports/ci-tests/v1",
    artifacts: {
      log: logPath,
      turboSummary: copiedTurboSummaryPath,
    },
    command,
    durationMs,
    environment: {
      bunMaxConcurrency: config.bunMaxConcurrency,
      logOrder: config.logOrder,
      outputLogs: config.outputLogs,
      turboConcurrency: config.turboConcurrency,
    },
    exitCode,
    filters: config.filters,
    finishedAt: finishedAt.toISOString(),
    github: {
      attempt: process.env["GITHUB_RUN_ATTEMPT"] ?? null,
      runId: process.env["GITHUB_RUN_ID"] ?? null,
      sha: process.env["GITHUB_SHA"] ?? null,
    },
    runId: config.runId,
    shard: config.shard,
    startedAt: startedAt.toISOString(),
    status: exitCode === 0 ? "passed" : "failed",
  };

  writeMetadata(metadataPath, metadata);
  logSink.end();

  process.stdout.write(
    [
      `[ci-test-runner] exitCode=${exitCode}`,
      `[ci-test-runner] diagnostics=${config.diagnosticsDir}`,
      `[ci-test-runner] metadata=${metadataPath}`,
      `[ci-test-runner] turboSummary=${copiedTurboSummaryPath ?? "none"}`,
    ].join("\n") + "\n"
  );

  return {
    exitCode,
    logPath,
    metadataPath,
    summaryArtifactPath: copiedTurboSummaryPath,
  };
}

if (import.meta.main) {
  const config = resolveCiTestRunnerConfig({
    cwd: process.cwd(),
  });
  const result = await runCiTests(config);
  process.exit(result.exitCode);
}
