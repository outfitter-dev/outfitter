/**
 * Tests for `outfitter init` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a temporary directory for testing.
 */
function createTempDir(): string {
	const tempDir = join(
		tmpdir(),
		`outfitter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
let originalIsTTY: boolean | undefined;

beforeEach(() => {
	originalIsTTY = process.stdout.isTTY;
	Object.defineProperty(process.stdout, "isTTY", {
		value: false,
		writable: true,
		configurable: true,
	});
	tempDir = createTempDir();
});

afterEach(() => {
	cleanupTempDir(tempDir);
	Object.defineProperty(process.stdout, "isTTY", {
		value: originalIsTTY,
		writable: true,
		configurable: true,
	});
});

// =============================================================================
// Init Command File Creation Tests
// =============================================================================

describe("init command file creation", () => {
	test("creates package.json in target directory", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const packageJsonPath = join(tempDir, "package.json");
		expect(existsSync(packageJsonPath)).toBe(true);

		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		expect(packageJson.name).toBe("test-project");
	});

	test("creates tsconfig.json in target directory", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const tsconfigPath = join(tempDir, "tsconfig.json");
		expect(existsSync(tsconfigPath)).toBe(true);

		const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
		expect(tsconfig.compilerOptions).toBeDefined();
	});

	test("creates src directory structure", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const srcDir = join(tempDir, "src");
		expect(existsSync(srcDir)).toBe(true);
	});

	test("creates src/index.ts entry point", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const indexPath = join(tempDir, "src", "index.ts");
		expect(existsSync(indexPath)).toBe(true);
	});
});

// =============================================================================
// Init Command Placeholder Replacement Tests
// =============================================================================

describe("init command placeholder replacement", () => {
	test("replaces {{name}} placeholder in package.json", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "my-awesome-project",
			template: "basic",
			force: false,
		});

		const packageJsonPath = join(tempDir, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

		expect(packageJson.name).toBe("my-awesome-project");
		// Ensure no unreplaced placeholders
		const content = readFileSync(packageJsonPath, "utf-8");
		expect(content).not.toContain("{{name}}");
	});

	test("replaces {{version}} placeholder with default version", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const packageJsonPath = join(tempDir, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

		expect(packageJson.version).toBe("0.1.0");
		const content = readFileSync(packageJsonPath, "utf-8");
		expect(content).not.toContain("{{version}}");
	});

	test("replaces {{description}} placeholder", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		const packageJsonPath = join(tempDir, "package.json");
		const content = readFileSync(packageJsonPath, "utf-8");

		expect(content).not.toContain("{{description}}");
	});
});

// =============================================================================
// Init Command Default Behavior Tests
// =============================================================================

describe("init command default behavior", () => {
	test("uses directory name as project name when not specified", async () => {
		const { runInit } = await import("../commands/init.js");

		const projectDir = join(tempDir, "my-project-dir");
		mkdirSync(projectDir, { recursive: true });

		await runInit({
			targetDir: projectDir,
			name: undefined,
			template: "basic",
			force: false,
		});

		const packageJsonPath = join(projectDir, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

		expect(packageJson.name).toBe("my-project-dir");
	});

	test("uses 'basic' template by default", async () => {
		const { runInit } = await import("../commands/init.js");

		await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: undefined,
			force: false,
		});

		// Should succeed without error using basic template
		const packageJsonPath = join(tempDir, "package.json");
		expect(existsSync(packageJsonPath)).toBe(true);
	});
});

// =============================================================================
// Init Command Force Flag Tests
// =============================================================================

describe("init command --force flag", () => {
	test("fails without --force when directory has existing files", async () => {
		const { runInit } = await import("../commands/init.js");

		// Create existing file
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "existing" }));

		const result = await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain("already exists");
		}
	});

	test("overwrites existing files with --force flag", async () => {
		const { runInit } = await import("../commands/init.js");

		// Create existing file
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "existing" }));

		const result = await runInit({
			targetDir: tempDir,
			name: "new-project",
			template: "basic",
			force: true,
		});

		expect(result.isOk()).toBe(true);

		const packageJsonPath = join(tempDir, "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		expect(packageJson.name).toBe("new-project");
	});
});

// =============================================================================
// Init Command Error Handling Tests
// =============================================================================

describe("init command error handling", () => {
	test("returns error for invalid template name", async () => {
		const { runInit } = await import("../commands/init.js");

		const result = await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "nonexistent-template",
			force: false,
		});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain("template");
		}
	});

	test("returns error when target directory does not exist and cannot be created", async () => {
		const { runInit } = await import("../commands/init.js");

		// Use a path that cannot be created (under a file instead of a directory)
		const invalidPath = join(tempDir, "file.txt", "nested");
		writeFileSync(join(tempDir, "file.txt"), "content");

		const result = await runInit({
			targetDir: invalidPath,
			name: "test-project",
			template: "basic",
			force: false,
		});

		expect(result.isErr()).toBe(true);
	});
});

// =============================================================================
// Init Command Result Type Tests
// =============================================================================

describe("init command result type", () => {
	test("returns Ok result on success", async () => {
		const { runInit } = await import("../commands/init.js");

		const result = await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		expect(result.isOk()).toBe(true);
	});

	test("returns Err result on failure", async () => {
		const { runInit } = await import("../commands/init.js");

		// Create existing file without force flag
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "existing" }));

		const result = await runInit({
			targetDir: tempDir,
			name: "test-project",
			template: "basic",
			force: false,
		});

		expect(result.isErr()).toBe(true);
	});
});
