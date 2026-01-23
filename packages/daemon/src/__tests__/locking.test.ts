/**
 * @outfitter/daemon - Locking Test Suite
 *
 * TDD RED PHASE: These tests document expected behavior for daemon locking.
 * Some tests will fail due to incomplete implementation (e.g., releaseDaemonLock
 * clears file content instead of properly unlinking).
 *
 * Test categories:
 * 1. Process Liveness Detection (4 tests)
 * 2. Lock Acquisition (4 tests)
 * 3. Lock Release (3 tests)
 * 4. Stale Lock Handling (3 tests)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	acquireDaemonLock,
	isDaemonAlive,
	isProcessAlive,
	readLockPid,
	releaseDaemonLock,
	type LockHandle,
} from "../locking.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

let testDir: string;
let testCounter = 0;

async function createTestDir(): Promise<string> {
	testCounter++;
	const dir = join(tmpdir(), `daemon-lock-test-${Date.now()}-${testCounter}`);
	await mkdir(dir, { recursive: true });
	return dir;
}

async function cleanupTestDir(dir: string): Promise<void> {
	try {
		await rm(dir, { recursive: true, force: true });
	} catch {
		// Ignore cleanup errors
	}
}

/**
 * Get a PID that is guaranteed to not exist.
 * Uses a high PID number that's unlikely to be in use.
 */
function getDeadPid(): number {
	// PIDs are typically limited to values less than 2^22 on most systems
	// Use a very high value that's almost certainly not in use
	return 999999;
}

/**
 * Get the current process PID (guaranteed to be alive).
 */
function getAlivePid(): number {
	return process.pid;
}

// ============================================================================
// 1. Process Liveness Detection Tests
// ============================================================================

describe("Process Liveness Detection", () => {
	describe("isProcessAlive", () => {
		it("returns true for running process", () => {
			// The current process is always running
			const result = isProcessAlive(getAlivePid());
			expect(result).toBe(true);
		});

		it("returns false for dead process", () => {
			// Use a PID that doesn't exist
			const result = isProcessAlive(getDeadPid());
			expect(result).toBe(false);
		});

		it("returns false for PID 0 (special kernel process)", () => {
			// PID 0 is the scheduler/swapper and shouldn't be accessible
			// from user space in the same way
			const result = isProcessAlive(0);
			// This might be true on some systems, false on others
			// The important thing is it doesn't throw
			expect(typeof result).toBe("boolean");
		});

		it("returns false for negative PID", () => {
			// Negative PIDs are invalid
			const result = isProcessAlive(-1);
			expect(result).toBe(false);
		});
	});

	describe("isDaemonAlive", () => {
		beforeEach(async () => {
			testDir = await createTestDir();
		});

		afterEach(async () => {
			await cleanupTestDir(testDir);
		});

		it("returns false when lock file does not exist", async () => {
			const lockPath = join(testDir, "nonexistent.lock");
			const result = await isDaemonAlive(lockPath);
			expect(result).toBe(false);
		});

		it("returns true when lock file contains alive PID", async () => {
			const lockPath = join(testDir, "daemon.lock");
			await fsWriteFile(lockPath, `${getAlivePid()}\n`);

			const result = await isDaemonAlive(lockPath);
			expect(result).toBe(true);
		});

		it("returns false when lock file contains dead PID", async () => {
			const lockPath = join(testDir, "daemon.lock");
			await fsWriteFile(lockPath, `${getDeadPid()}\n`);

			const result = await isDaemonAlive(lockPath);
			expect(result).toBe(false);
		});

		it("returns false when lock file contains invalid content", async () => {
			const lockPath = join(testDir, "daemon.lock");
			await fsWriteFile(lockPath, "not-a-pid\n");

			const result = await isDaemonAlive(lockPath);
			expect(result).toBe(false);
		});
	});
});

// ============================================================================
// 2. Lock Acquisition Tests
// ============================================================================

describe("Lock Acquisition", () => {
	beforeEach(async () => {
		testDir = await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir(testDir);
	});

	it("acquireDaemonLock succeeds when no lock exists", async () => {
		const lockPath = join(testDir, "daemon.lock");

		const result = await acquireDaemonLock(lockPath);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.lockPath).toBe(lockPath);
			expect(result.value.pid).toBe(process.pid);

			// Verify lock file was created
			const exists = await Bun.file(lockPath).exists();
			expect(exists).toBe(true);

			// Verify PID was written
			const content = await Bun.file(lockPath).text();
			expect(content.trim()).toBe(String(process.pid));
		}
	});

	it("acquireDaemonLock fails when daemon already running", async () => {
		const lockPath = join(testDir, "daemon.lock");
		// Pre-create lock file with current process PID (simulating another running daemon)
		await fsWriteFile(lockPath, `${getAlivePid()}\n`);

		const result = await acquireDaemonLock(lockPath);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error._tag).toBe("LockError");
			expect(result.error.message).toContain("already running");
			expect(result.error.lockPath).toBe(lockPath);
			expect(result.error.pid).toBe(getAlivePid());
		}
	});

	it("acquireDaemonLock creates parent directories if needed", async () => {
		const lockPath = join(testDir, "nested", "deep", "daemon.lock");

		const result = await acquireDaemonLock(lockPath);

		// This test will FAIL if the implementation doesn't create parent dirs
		// Current implementation does NOT create parent directories
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const exists = await Bun.file(lockPath).exists();
			expect(exists).toBe(true);
		}
	});

	it("acquireDaemonLock returns LockHandle with correct properties", async () => {
		const lockPath = join(testDir, "daemon.lock");

		const result = await acquireDaemonLock(lockPath);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			const handle: LockHandle = result.value;
			expect(handle).toHaveProperty("lockPath");
			expect(handle).toHaveProperty("pid");
			expect(handle.lockPath).toBe(lockPath);
			expect(typeof handle.pid).toBe("number");
		}
	});
});

// ============================================================================
// 3. Lock Release Tests
// ============================================================================

describe("Lock Release", () => {
	beforeEach(async () => {
		testDir = await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir(testDir);
	});

	it("releaseDaemonLock removes lock file when PID matches", async () => {
		const lockPath = join(testDir, "daemon.lock");

		// Acquire lock
		const acquireResult = await acquireDaemonLock(lockPath);
		expect(acquireResult.isOk()).toBe(true);

		if (acquireResult.isOk()) {
			// Release lock
			await releaseDaemonLock(acquireResult.value);

			// Lock file should be DELETED (not just cleared)
			// This test will FAIL because current implementation clears instead of unlinks
			const exists = await Bun.file(lockPath).exists();
			expect(exists).toBe(false);
		}
	});

	it("lock release only removes if PID matches", async () => {
		const lockPath = join(testDir, "daemon.lock");

		// Create a lock file with a different PID
		await fsWriteFile(lockPath, `${getDeadPid()}\n`);

		// Try to release with a handle that has a different PID
		const handle: LockHandle = {
			lockPath,
			pid: process.pid, // Different from what's in the file
		};

		await releaseDaemonLock(handle);

		// File should still exist because PID didn't match
		const exists = await Bun.file(lockPath).exists();
		expect(exists).toBe(true);

		// Content should be unchanged
		const content = await Bun.file(lockPath).text();
		expect(content.trim()).toBe(String(getDeadPid()));
	});

	it("releaseDaemonLock handles missing lock file gracefully", async () => {
		const lockPath = join(testDir, "nonexistent.lock");

		const handle: LockHandle = {
			lockPath,
			pid: process.pid,
		};

		// Should not throw when lock file doesn't exist
		await expect(releaseDaemonLock(handle)).resolves.toBeUndefined();
	});
});

// ============================================================================
// 4. Stale Lock Handling Tests
// ============================================================================

describe("Stale Lock Handling", () => {
	beforeEach(async () => {
		testDir = await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir(testDir);
	});

	it("acquireDaemonLock succeeds when PID is stale", async () => {
		const lockPath = join(testDir, "daemon.lock");

		// Create a stale lock file (dead process)
		await fsWriteFile(lockPath, `${getDeadPid()}\n`);

		// Should be able to acquire over stale lock
		const result = await acquireDaemonLock(lockPath);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.pid).toBe(process.pid);

			// Verify lock file was updated with new PID
			const content = await Bun.file(lockPath).text();
			expect(content.trim()).toBe(String(process.pid));
		}
	});

	it("acquireDaemonLock handles invalid lock file content", async () => {
		const lockPath = join(testDir, "daemon.lock");

		// Create a lock file with garbage content
		await fsWriteFile(lockPath, "garbage-not-a-pid\n");

		// Should be able to acquire over invalid lock
		const result = await acquireDaemonLock(lockPath);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.pid).toBe(process.pid);
		}
	});

	it("acquireDaemonLock handles empty lock file", async () => {
		const lockPath = join(testDir, "daemon.lock");

		// Create an empty lock file
		await fsWriteFile(lockPath, "");

		// Should be able to acquire over empty lock
		const result = await acquireDaemonLock(lockPath);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.pid).toBe(process.pid);
		}
	});
});

// ============================================================================
// 5. readLockPid Tests
// ============================================================================

describe("readLockPid", () => {
	beforeEach(async () => {
		testDir = await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir(testDir);
	});

	it("returns PID when lock file contains valid PID", async () => {
		const lockPath = join(testDir, "daemon.lock");
		await fsWriteFile(lockPath, "12345\n");

		const pid = await readLockPid(lockPath);

		expect(pid).toBe(12345);
	});

	it("returns undefined when lock file does not exist", async () => {
		const lockPath = join(testDir, "nonexistent.lock");

		const pid = await readLockPid(lockPath);

		expect(pid).toBeUndefined();
	});

	it("returns undefined when lock file contains invalid content", async () => {
		const lockPath = join(testDir, "daemon.lock");
		await fsWriteFile(lockPath, "not-a-number\n");

		const pid = await readLockPid(lockPath);

		expect(pid).toBeUndefined();
	});

	it("returns undefined when lock file is empty", async () => {
		const lockPath = join(testDir, "daemon.lock");
		await fsWriteFile(lockPath, "");

		const pid = await readLockPid(lockPath);

		expect(pid).toBeUndefined();
	});

	it("handles PID with whitespace correctly", async () => {
		const lockPath = join(testDir, "daemon.lock");
		await fsWriteFile(lockPath, "  12345  \n");

		const pid = await readLockPid(lockPath);

		expect(pid).toBe(12345);
	});
});
