/**
 * Tests for `outfitter doctor` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a temporary directory for testing.
 */
function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary directory.
 */
function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

// =============================================================================
// Doctor Command Bun Version Check Tests
// =============================================================================

describe("doctor command Bun version check", () => {
  test("passes when Bun version is 1.3.6 or higher", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const result = await runDoctor({ cwd: tempDir });

    // Bun version should pass (we're running on Bun)
    expect(result.checks.bunVersion.passed).toBe(true);
  });

  test("includes Bun version in check result", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.bunVersion.version).toBeDefined();
    expect(typeof result.checks.bunVersion.version).toBe("string");
  });

  test("Bun version check includes minimum requirement info", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.bunVersion.required).toBe("1.3.6");
  });
});

// =============================================================================
// Doctor Command Package.json Validation Tests
// =============================================================================

describe("doctor command package.json validation", () => {
  test("passes when valid package.json exists", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      type: "module",
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.packageJson.passed).toBe(true);
  });

  test("fails when package.json does not exist", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.packageJson.passed).toBe(false);
    expect(result.checks.packageJson.error).toContain("not found");
  });

  test("fails when package.json is invalid JSON", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    writeFileSync(join(tempDir, "package.json"), "{ invalid json }");

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.packageJson.passed).toBe(false);
    expect(result.checks.packageJson.error).toContain("invalid");
  });

  test("fails when package.json is missing required fields", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    // Missing name and version
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ type: "module" })
    );

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.packageJson.passed).toBe(false);
  });
});

// =============================================================================
// Doctor Command Dependencies Check Tests
// =============================================================================

describe("doctor command dependencies check", () => {
  test("passes when node_modules exists and has expected structure", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "some-dep": "^1.0.0",
      },
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create node_modules with a dependency
    mkdirSync(join(tempDir, "node_modules", "some-dep"), { recursive: true });

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.dependencies.passed).toBe(true);
  });

  test("fails when node_modules does not exist but package.json has dependencies", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "some-dep": "^1.0.0",
      },
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.dependencies.passed).toBe(false);
    expect(result.checks.dependencies.error).toContain("install");
  });

  test("passes when no dependencies are declared", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = {
      name: "test-project",
      version: "1.0.0",
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    const result = await runDoctor({ cwd: tempDir });

    // No dependencies means check passes (nothing to verify)
    expect(result.checks.dependencies.passed).toBe(true);
  });
});

// =============================================================================
// Doctor Command Config Files Check Tests
// =============================================================================

describe("doctor command config files check", () => {
  test("passes when tsconfig.json exists", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const tsconfig = { compilerOptions: { strict: true } };
    writeFileSync(join(tempDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.configFiles.tsconfig).toBe(true);
  });

  test("reports missing tsconfig.json", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.configFiles.tsconfig).toBe(false);
  });
});

// =============================================================================
// Doctor Command Required Directories Check Tests
// =============================================================================

describe("doctor command required directories check", () => {
  test("passes when src directory exists", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));
    mkdirSync(join(tempDir, "src"), { recursive: true });

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.directories.src).toBe(true);
  });

  test("reports missing src directory", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const result = await runDoctor({ cwd: tempDir });

    expect(result.checks.directories.src).toBe(false);
  });
});

// =============================================================================
// Doctor Command Exit Code Tests
// =============================================================================

describe("doctor command exit codes", () => {
  test("returns exit code 0 when all checks pass", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    // Set up a valid project
    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));
    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: {} })
    );
    mkdirSync(join(tempDir, "src"), { recursive: true });

    const result = await runDoctor({ cwd: tempDir });

    expect(result.exitCode).toBe(0);
  });

  test("returns exit code 1 when any check fails", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    // Empty directory - many checks will fail
    const result = await runDoctor({ cwd: tempDir });

    expect(result.exitCode).toBe(1);
  });
});

// =============================================================================
// Doctor Command Output Format Tests
// =============================================================================

describe("doctor command output format", () => {
  test("outputs pass/fail status for each check", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const result = await runDoctor({ cwd: tempDir });

    // Result should have structured check information
    expect(result.checks).toBeDefined();
    expect(typeof result.checks.bunVersion.passed).toBe("boolean");
    expect(typeof result.checks.packageJson.passed).toBe("boolean");
  });

  test("includes summary of passed and failed checks", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const packageJson = { name: "test", version: "1.0.0" };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson));

    const result = await runDoctor({ cwd: tempDir });

    expect(result.summary).toBeDefined();
    expect(typeof result.summary.passed).toBe("number");
    expect(typeof result.summary.failed).toBe("number");
    expect(typeof result.summary.total).toBe("number");
  });
});

// =============================================================================
// Doctor Command Result Type Tests
// =============================================================================

describe("doctor command result structure", () => {
  test("returns well-structured DoctorResult", async () => {
    const { runDoctor } = await import("../commands/doctor.js");

    const result = await runDoctor({ cwd: tempDir });

    // Verify structure
    expect(result).toHaveProperty("checks");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("exitCode");

    // Check nested structure
    expect(result.checks).toHaveProperty("bunVersion");
    expect(result.checks).toHaveProperty("packageJson");
    expect(result.checks).toHaveProperty("dependencies");
    expect(result.checks).toHaveProperty("configFiles");
    expect(result.checks).toHaveProperty("directories");
  });
});
