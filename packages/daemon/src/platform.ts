/**
 * Platform abstraction for daemon socket and lock paths.
 *
 * Provides platform-specific path resolution for Unix domain sockets
 * (macOS/Linux) and named pipes (Windows).
 *
 * @packageDocumentation
 */

import * as path from "node:path";
import * as os from "node:os";

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Check if running on a Unix-like platform (macOS or Linux).
 *
 * @returns true on macOS/Linux, false on Windows
 *
 * @example
 * ```typescript
 * if (isUnixPlatform()) {
 *   // Use Unix domain sockets
 * } else {
 *   // Use named pipes
 * }
 * ```
 */
export function isUnixPlatform(): boolean {
	const platform = os.platform();
	return platform === "darwin" || platform === "linux";
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get the runtime directory for daemon files.
 *
 * Resolves XDG_RUNTIME_DIR on Unix-like systems, or platform-specific
 * fallbacks:
 * - Linux: `$XDG_RUNTIME_DIR` or `/run/user/<uid>`
 * - macOS: `$TMPDIR`
 * - Windows: `%TEMP%`
 *
 * @returns Absolute path to runtime directory
 *
 * @internal
 */
function getRuntimeDir(): string {
	// XDG_RUNTIME_DIR takes precedence
	const xdgRuntime = process.env["XDG_RUNTIME_DIR"];
	if (xdgRuntime) {
		return xdgRuntime;
	}

	const platform = os.platform();

	if (platform === "darwin") {
		// macOS: use TMPDIR
		return process.env["TMPDIR"] ?? os.tmpdir();
	}

	if (platform === "linux") {
		// Linux: fallback to /run/user/<uid>
		return `/run/user/${os.userInfo().uid}`;
	}

	// Windows: use TEMP
	return process.env["TEMP"] ?? os.tmpdir();
}

/**
 * Get the Unix domain socket path for a tool's daemon.
 *
 * @param toolName - Name of the tool (e.g., "waymark", "firewatch")
 * @returns Absolute path to the daemon socket
 *
 * @example
 * ```typescript
 * const socketPath = getSocketPath("waymark");
 * // "/run/user/1000/waymark/daemon.sock" on Linux
 * // "/var/folders/.../waymark/daemon.sock" on macOS
 * ```
 */
export function getSocketPath(toolName: string): string {
	if (!isUnixPlatform()) {
		// Windows named pipe format
		return `\\\\.\\pipe\\${toolName}-daemon`;
	}

	return path.join(getRuntimeDir(), toolName, "daemon.sock");
}

/**
 * Get the lock file path for a tool's daemon.
 *
 * @param toolName - Name of the tool (e.g., "waymark", "firewatch")
 * @returns Absolute path to the daemon lock file
 *
 * @example
 * ```typescript
 * const lockPath = getLockPath("waymark");
 * // "/run/user/1000/waymark/daemon.lock" on Linux
 * ```
 */
export function getLockPath(toolName: string): string {
	if (!isUnixPlatform()) {
		// Windows: store lock file in temp directory
		return path.join(os.tmpdir(), `${toolName}-daemon.lock`);
	}

	return path.join(getRuntimeDir(), toolName, "daemon.lock");
}

/**
 * Get the PID file path for a tool's daemon.
 *
 * @param toolName - Name of the tool (e.g., "waymark", "firewatch")
 * @returns Absolute path to the daemon PID file
 *
 * @example
 * ```typescript
 * const pidPath = getPidPath("waymark");
 * // "/run/user/1000/waymark/daemon.pid" on Linux
 * ```
 */
export function getPidPath(toolName: string): string {
	if (!isUnixPlatform()) {
		// Windows: store PID file in temp directory
		return path.join(os.tmpdir(), `${toolName}-daemon.pid`);
	}

	return path.join(getRuntimeDir(), toolName, "daemon.pid");
}

/**
 * Get the directory containing daemon files for a tool.
 *
 * @param toolName - Name of the tool (e.g., "waymark", "firewatch")
 * @returns Absolute path to the daemon directory
 *
 * @example
 * ```typescript
 * const daemonDir = getDaemonDir("waymark");
 * // "/run/user/1000/waymark" on Linux
 * ```
 */
export function getDaemonDir(toolName: string): string {
	if (!isUnixPlatform()) {
		return os.tmpdir();
	}

	return path.join(getRuntimeDir(), toolName);
}
