/**
 * @outfitter/testing
 *
 * Test harnesses, fixtures, and utilities for Outfitter packages.
 * Provides reusable testing infrastructure including:
 *
 * - **Fixtures**: Factory functions for creating test data with defaults
 * - **CLI Harness**: Execute and capture CLI command output
 * - **MCP Harness**: Test MCP server tool invocations
 * - **Temp Directory**: Run tests with isolated temporary directories
 * - **Environment**: Run tests with temporary environment variables
 *
 * @packageDocumentation
 */

// ============================================================================
// Fixtures
// ============================================================================

export {
  createFixture,
  loadFixture,
  withEnv,
  withTempDir,
} from "./fixtures.js";

// ============================================================================
// CLI Harness
// ============================================================================

export {
  type CliHarness,
  type CliResult,
  createCliHarness,
} from "./cli-harness.js";
export { type CliTestResult, captureCLI, mockStdin } from "./cli-helpers.js";

// ============================================================================
// MCP Harness
// ============================================================================

export {
  createMCPTestHarness,
  createMcpHarness,
  createMcpTestHarness,
  type McpHarness,
  type McpTestHarnessOptions,
  type McpToolResponse,
} from "./mcp-harness.js";

// ============================================================================
// Mock Factories
// ============================================================================

export {
  createTestConfig,
  createTestContext,
  createTestLogger,
  type LogEntry,
  type TestLogger,
} from "./mock-factories.js";
