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

export { createFixture, loadFixture, withTempDir, withEnv } from "./fixtures.js";

// ============================================================================
// CLI Harness
// ============================================================================

export { createCliHarness, type CliHarness, type CliResult } from "./cli-harness.js";
export { captureCLI, mockStdin, type CliTestResult } from "./cli-helpers.js";

// ============================================================================
// MCP Harness
// ============================================================================

export {
	createMcpHarness,
	createMCPTestHarness,
	createMcpTestHarness,
	type McpHarness,
	type McpToolResponse,
	type McpTestHarnessOptions,
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
