import { describe, expect, test } from "bun:test";

import {
  buildTurboCiTestCommand,
  resolveCiTestRunnerConfig,
} from "./ci-test-runner";

describe("resolveCiTestRunnerConfig", () => {
  test("uses deterministic defaults when no env overrides are set", () => {
    const config = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: {},
      now: new Date("2026-02-25T12:00:00.000Z"),
    });

    expect(config.rootDir).toBe("/repo");
    expect(config.diagnosticsDir).toBe("/repo/.outfitter/reports/ci");
    expect(config.turboConcurrency).toBe(2);
    expect(config.bunMaxConcurrency).toBe(4);
    expect(config.logOrder).toBe("stream");
    expect(config.outputLogs).toBe("full");
    expect(config.runId).toBe("local-20260225T120000000Z");
    expect(config.filters).toEqual([]);
    expect(config.shard).toBeNull();
  });

  test("accepts CI env overrides and GitHub run metadata", () => {
    const config = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: {
        OUTFITTER_CI_TURBO_CONCURRENCY: "1",
        OUTFITTER_CI_BUN_MAX_CONCURRENCY: "3",
        OUTFITTER_CI_TURBO_LOG_ORDER: "grouped",
        OUTFITTER_CI_TURBO_OUTPUT_LOGS: "errors-only",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_ATTEMPT: "3",
      },
      now: new Date("2026-02-25T12:00:00.000Z"),
    });

    expect(config.turboConcurrency).toBe(1);
    expect(config.bunMaxConcurrency).toBe(3);
    expect(config.logOrder).toBe("grouped");
    expect(config.outputLogs).toBe("errors-only");
    expect(config.runId).toBe("gha-42-3-20260225T120000000Z");
  });

  test("parses OUTFITTER_CI_TEST_FILTER into filters array", () => {
    const config = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: {
        OUTFITTER_CI_TEST_FILTER:
          "@outfitter/contracts,@outfitter/types, @outfitter/config",
      },
      now: new Date("2026-02-25T12:00:00.000Z"),
    });

    expect(config.filters).toEqual([
      "@outfitter/contracts",
      "@outfitter/types",
      "@outfitter/config",
    ]);
  });

  test("parses OUTFITTER_CI_TEST_SHARD into shard label", () => {
    const config = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: { OUTFITTER_CI_TEST_SHARD: "foundation" },
      now: new Date("2026-02-25T12:00:00.000Z"),
    });

    expect(config.shard).toBe("foundation");
  });

  test("returns empty filters for missing or empty OUTFITTER_CI_TEST_FILTER", () => {
    const empty = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: { OUTFITTER_CI_TEST_FILTER: "" },
      now: new Date("2026-02-25T12:00:00.000Z"),
    });
    expect(empty.filters).toEqual([]);

    const missing = resolveCiTestRunnerConfig({
      cwd: "/repo",
      env: {},
      now: new Date("2026-02-25T12:00:00.000Z"),
    });
    expect(missing.filters).toEqual([]);
  });
});

describe("buildTurboCiTestCommand", () => {
  test("builds command without filters when none provided", () => {
    const command = buildTurboCiTestCommand({
      bunMaxConcurrency: 3,
      filters: [],
      logOrder: "grouped",
      outputLogs: "errors-only",
      turboConcurrency: 1,
    });

    expect(command).toEqual([
      "bun",
      "x",
      "turbo",
      "run",
      "test",
      "--no-daemon",
      "--only",
      "--concurrency",
      "1",
      "--output-logs",
      "errors-only",
      "--log-order",
      "grouped",
      "--log-prefix",
      "task",
      "--summarize",
      "--",
      "--max-concurrency",
      "3",
    ]);
  });

  test("injects --filter flags before --no-daemon", () => {
    const command = buildTurboCiTestCommand({
      bunMaxConcurrency: 4,
      filters: ["@outfitter/contracts", "@outfitter/types"],
      logOrder: "stream",
      outputLogs: "full",
      turboConcurrency: 2,
    });

    expect(command).toEqual([
      "bun",
      "x",
      "turbo",
      "run",
      "test",
      "--filter",
      "@outfitter/contracts",
      "--filter",
      "@outfitter/types",
      "--no-daemon",
      "--only",
      "--concurrency",
      "2",
      "--output-logs",
      "full",
      "--log-order",
      "stream",
      "--log-prefix",
      "task",
      "--summarize",
      "--",
      "--max-concurrency",
      "4",
    ]);
  });
});
