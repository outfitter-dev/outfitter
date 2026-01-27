/**
 * @outfitter/daemon - Health Check Test Suite
 *
 * TDD RED PHASE: Tests for health check functionality.
 *
 * Test categories:
 * 1. Health Checker Creation (3 tests)
 * 2. Check Execution (4 tests)
 * 3. Status Reporting (4 tests)
 * 4. Dynamic Registration (3 tests)
 */

import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { createHealthChecker, type HealthCheck } from "../health.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

function createPassingCheck(name: string): HealthCheck {
  return {
    name,
    check: async () => Result.ok(undefined),
  };
}

function createFailingCheck(name: string, message: string): HealthCheck {
  return {
    name,
    check: async () => Result.err(new Error(message)),
  };
}

function createSlowCheck(name: string, delayMs: number): HealthCheck {
  return {
    name,
    check: async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return Result.ok(undefined);
    },
  };
}

// ============================================================================
// 1. Health Checker Creation Tests
// ============================================================================

describe("Health Checker Creation", () => {
  it("creates health checker with no checks", () => {
    const checker = createHealthChecker([]);
    expect(checker).toBeDefined();
    expect(typeof checker.check).toBe("function");
    expect(typeof checker.register).toBe("function");
  });

  it("creates health checker with initial checks", () => {
    const checks = [createPassingCheck("db"), createPassingCheck("cache")];
    const checker = createHealthChecker(checks);
    expect(checker).toBeDefined();
  });

  it("accepts various check implementations", () => {
    const checks: HealthCheck[] = [
      {
        name: "simple",
        check: async () => Result.ok(undefined),
      },
      {
        name: "with-logic",
        check: async () => {
          const isHealthy = true;
          if (isHealthy) {
            return Result.ok(undefined);
          }
          return Result.err(new Error("Unhealthy"));
        },
      },
    ];
    const checker = createHealthChecker(checks);
    expect(checker).toBeDefined();
  });
});

// ============================================================================
// 2. Check Execution Tests
// ============================================================================

describe("Check Execution", () => {
  it("executes all registered checks", async () => {
    let dbChecked = false;
    let cacheChecked = false;

    const checks: HealthCheck[] = [
      {
        name: "db",
        check: async () => {
          dbChecked = true;
          return Result.ok(undefined);
        },
      },
      {
        name: "cache",
        check: async () => {
          cacheChecked = true;
          return Result.ok(undefined);
        },
      },
    ];

    const checker = createHealthChecker(checks);
    await checker.check();

    expect(dbChecked).toBe(true);
    expect(cacheChecked).toBe(true);
  });

  it("runs checks in parallel", async () => {
    const startTime = Date.now();

    const checks = [
      createSlowCheck("check1", 50),
      createSlowCheck("check2", 50),
    ];

    const checker = createHealthChecker(checks);
    await checker.check();

    const elapsed = Date.now() - startTime;
    // If run sequentially, would take ~100ms
    // If run in parallel, should take ~50ms (with some overhead)
    expect(elapsed).toBeLessThan(90);
  });

  it("continues checking even if one check fails", async () => {
    let secondCheckRan = false;

    const checks: HealthCheck[] = [
      createFailingCheck("failing", "First check failed"),
      {
        name: "passing",
        check: async () => {
          secondCheckRan = true;
          return Result.ok(undefined);
        },
      },
    ];

    const checker = createHealthChecker(checks);
    await checker.check();

    expect(secondCheckRan).toBe(true);
  });

  it("handles check exceptions gracefully", async () => {
    const checks: HealthCheck[] = [
      {
        name: "throwing",
        check: async () => {
          throw new Error("Unexpected error");
        },
      },
      createPassingCheck("passing"),
    ];

    const checker = createHealthChecker(checks);
    const status = await checker.check();

    // Should not throw, should report unhealthy for the throwing check
    expect(status.checks.throwing?.healthy).toBe(false);
    expect(status.checks.passing?.healthy).toBe(true);
  });
});

// ============================================================================
// 3. Status Reporting Tests
// ============================================================================

describe("Status Reporting", () => {
  it("reports healthy when all checks pass", async () => {
    const checks = [createPassingCheck("db"), createPassingCheck("cache")];
    const checker = createHealthChecker(checks);

    const status = await checker.check();

    expect(status.healthy).toBe(true);
    expect(status.checks.db?.healthy).toBe(true);
    expect(status.checks.cache?.healthy).toBe(true);
  });

  it("reports unhealthy when any check fails", async () => {
    const checks = [
      createPassingCheck("db"),
      createFailingCheck("cache", "Connection failed"),
    ];
    const checker = createHealthChecker(checks);

    const status = await checker.check();

    expect(status.healthy).toBe(false);
    expect(status.checks.db?.healthy).toBe(true);
    expect(status.checks.cache?.healthy).toBe(false);
  });

  it("includes error message for failed checks", async () => {
    const checks = [createFailingCheck("db", "Connection refused")];
    const checker = createHealthChecker(checks);

    const status = await checker.check();

    expect(status.checks.db?.healthy).toBe(false);
    expect(status.checks.db?.message).toBe("Connection refused");
  });

  it("includes uptime in status", async () => {
    const checker = createHealthChecker([]);

    // Wait a bit to ensure uptime is measurable
    await new Promise((resolve) => setTimeout(resolve, 50));

    const status = await checker.check();

    expect(typeof status.uptime).toBe("number");
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// 4. Dynamic Registration Tests
// ============================================================================

describe("Dynamic Registration", () => {
  it("allows registering new checks at runtime", async () => {
    const checker = createHealthChecker([]);

    checker.register(createPassingCheck("dynamic"));

    const status = await checker.check();
    expect(status.checks.dynamic?.healthy).toBe(true);
  });

  it("includes dynamically registered checks in health status", async () => {
    const checker = createHealthChecker([createPassingCheck("initial")]);

    checker.register(createPassingCheck("added1"));
    checker.register(createPassingCheck("added2"));

    const status = await checker.check();

    expect(Object.keys(status.checks)).toHaveLength(3);
    expect(status.checks.initial?.healthy).toBe(true);
    expect(status.checks.added1?.healthy).toBe(true);
    expect(status.checks.added2?.healthy).toBe(true);
  });

  it("handles registration of failing checks", async () => {
    const checker = createHealthChecker([createPassingCheck("initial")]);

    // Initially healthy
    let status = await checker.check();
    expect(status.healthy).toBe(true);

    // Register a failing check
    checker.register(createFailingCheck("failing", "Service down"));

    // Now unhealthy
    status = await checker.check();
    expect(status.healthy).toBe(false);
  });
});
