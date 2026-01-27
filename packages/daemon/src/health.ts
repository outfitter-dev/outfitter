/**
 * Health check utilities for daemon processes.
 *
 * Provides a health checker that can run multiple health checks in parallel
 * and aggregate their results into a single health status.
 *
 * @packageDocumentation
 */

import type { Result } from "@outfitter/contracts";

// ============================================================================
// Types
// ============================================================================

/**
 * A single health check definition.
 *
 * Health checks are used to verify that a service or resource is functioning
 * correctly. Each check has a name for identification and a check function
 * that returns a Result indicating success or failure.
 *
 * @example
 * ```typescript
 * const databaseCheck: HealthCheck = {
 *   name: "database",
 *   check: async () => {
 *     try {
 *       await db.ping();
 *       return Result.ok(undefined);
 *     } catch (error) {
 *       return Result.err(error);
 *     }
 *   },
 * };
 * ```
 */
export interface HealthCheck {
  /**
   * Unique name identifying this health check.
   * Used as the key in the HealthStatus.checks record.
   */
  name: string;

  /**
   * Function that performs the health check.
   *
   * Should return Result.ok(undefined) if healthy, or Result.err(error)
   * with details about the failure.
   */
  check(): Promise<Result<void, Error>>;
}

/**
 * Result of an individual health check.
 *
 * Contains the healthy/unhealthy status and an optional message
 * providing more details (typically the error message on failure).
 */
export interface HealthCheckResult {
  /** Whether this check passed (true) or failed (false) */
  healthy: boolean;
  /** Optional message, typically the error message on failure */
  message?: string;
}

/**
 * Aggregated health status from all registered checks.
 *
 * The overall healthy status is true only if ALL individual checks pass.
 * Includes the uptime of the health checker in seconds.
 *
 * @example
 * ```typescript
 * const status: HealthStatus = {
 *   healthy: false,
 *   checks: {
 *     database: { healthy: true },
 *     cache: { healthy: false, message: "Connection refused" },
 *   },
 *   uptime: 3600,
 * };
 * ```
 */
export interface HealthStatus {
  /** Overall health status - true only if ALL checks pass */
  healthy: boolean;

  /** Individual check results keyed by check name */
  checks: Record<string, HealthCheckResult>;

  /** Uptime in seconds since the health checker was created */
  uptime: number;
}

/**
 * Health checker interface for managing and running health checks.
 *
 * Provides methods to run all registered checks and get the aggregated
 * health status, as well as dynamically registering new checks at runtime.
 *
 * @example
 * ```typescript
 * const checker = createHealthChecker([
 *   { name: "db", check: checkDatabase },
 *   { name: "cache", check: checkCache },
 * ]);
 *
 * // Later, add more checks
 * checker.register({ name: "queue", check: checkQueue });
 *
 * // Get health status
 * const status = await checker.check();
 * console.log("Healthy:", status.healthy);
 * ```
 */
export interface HealthChecker {
  /**
   * Run all registered health checks and return aggregated status.
   *
   * Checks are run in parallel for efficiency. The overall healthy
   * status is true only if all individual checks pass.
   *
   * @returns Aggregated health status
   */
  check(): Promise<HealthStatus>;

  /**
   * Register a new health check at runtime.
   *
   * The check will be included in all subsequent calls to check().
   *
   * @param check - Health check to register
   */
  register(check: HealthCheck): void;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a health checker with initial checks.
 *
 * The health checker runs all registered checks in parallel and aggregates
 * their results. Individual check failures are isolated and don't prevent
 * other checks from running.
 *
 * @param checks - Initial health checks to register
 * @returns HealthChecker instance
 *
 * @example
 * ```typescript
 * const checker = createHealthChecker([
 *   {
 *     name: "database",
 *     check: async () => {
 *       await db.ping();
 *       return Result.ok(undefined);
 *     },
 *   },
 *   {
 *     name: "cache",
 *     check: async () => {
 *       await redis.ping();
 *       return Result.ok(undefined);
 *     },
 *   },
 * ]);
 *
 * // Run health checks
 * const status = await checker.check();
 *
 * if (!status.healthy) {
 *   console.error("Service unhealthy:", status.checks);
 * }
 * ```
 */
export function createHealthChecker(checks: HealthCheck[]): HealthChecker {
  const registeredChecks: HealthCheck[] = [...checks];
  const startTime = Date.now();

  async function runCheck(check: HealthCheck): Promise<HealthCheckResult> {
    try {
      const result = await check.check();

      if (result.isOk()) {
        return { healthy: true };
      }

      return {
        healthy: false,
        message: result.error.message,
      };
    } catch (error) {
      // Handle thrown exceptions as failures
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return {
    async check(): Promise<HealthStatus> {
      // Run all checks in parallel
      const results = await Promise.all(
        registeredChecks.map(async (check) => ({
          name: check.name,
          result: await runCheck(check),
        }))
      );

      // Aggregate results
      const checksRecord: Record<string, HealthCheckResult> = {};
      let allHealthy = true;

      for (const { name, result } of results) {
        checksRecord[name] = result;
        if (!result.healthy) {
          allHealthy = false;
        }
      }

      // Calculate uptime in seconds
      const uptime = Math.floor((Date.now() - startTime) / 1000);

      return {
        healthy: allHealthy,
        checks: checksRecord,
        uptime,
      };
    },

    register(check: HealthCheck): void {
      registeredChecks.push(check);
    },
  };
}
