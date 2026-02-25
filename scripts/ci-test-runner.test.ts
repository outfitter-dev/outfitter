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
    expect(config.diagnosticsDir).toBe("/repo/.outfitter/ci");
    expect(config.turboConcurrency).toBe(2);
    expect(config.bunMaxConcurrency).toBe(4);
    expect(config.logOrder).toBe("stream");
    expect(config.outputLogs).toBe("full");
    expect(config.runId).toBe("local-20260225T120000000Z");
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
});

describe("buildTurboCiTestCommand", () => {
  test("builds an explicit turbo + bun-concurrency command", () => {
    const command = buildTurboCiTestCommand({
      bunMaxConcurrency: 3,
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
});
