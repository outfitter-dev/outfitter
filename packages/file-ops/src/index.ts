/**
 * @outfitter/file-ops
 *
 * Workspace detection, secure path handling, glob patterns, file locking,
 * and atomic write utilities. Provides safe file system operations with
 * path traversal protection and cross-process coordination.
 *
 * @packageDocumentation
 */

import {
	ConflictError,
	InternalError,
	NotFoundError,
	Result,
	ValidationError,
} from "@outfitter/contracts";
import { mkdir, rename, stat, unlink, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for workspace root detection.
 *
 * Configure which marker files trigger workspace detection and where to stop searching.
 */
export interface FindWorkspaceRootOptions {
	/**
	 * Marker files/directories to search for.
	 * Search stops when any marker is found at a directory level.
	 * @defaultValue [".git", "package.json"]
	 */
	markers?: string[];
	/**
	 * Stop searching at this directory boundary.
	 * The search will not continue above this path.
	 * @defaultValue filesystem root
	 */
	stopAt?: string;
}

/**
 * Options for glob operations.
 *
 * Configure base directory, exclusion patterns, and file matching behavior.
 */
export interface GlobOptions {
	/**
	 * Base directory for glob matching.
	 * All returned paths will be absolute paths within this directory.
	 * @defaultValue process.cwd()
	 */
	cwd?: string;
	/**
	 * Patterns to exclude from results.
	 * Supports negation with "!" prefix to re-include previously excluded files.
	 */
	ignore?: string[];
	/**
	 * Follow symbolic links when scanning directories.
	 * @defaultValue false
	 */
	followSymlinks?: boolean;
	/**
	 * Include files and directories starting with a dot in results.
	 * @defaultValue false
	 */
	dot?: boolean;
}

/**
 * Options for atomic write operations.
 *
 * Configure directory creation, permission handling, and file modes.
 */
export interface AtomicWriteOptions {
	/**
	 * Create parent directories if they do not exist.
	 * Uses recursive mkdir when enabled.
	 * @defaultValue true
	 */
	createParentDirs?: boolean;
	/**
	 * Preserve file permissions from existing file.
	 * If the target file does not exist, falls back to the mode option.
	 * @defaultValue false
	 */
	preservePermissions?: boolean;
	/**
	 * Unix file mode for newly created files.
	 * @defaultValue 0o644
	 */
	mode?: number;
}

/**
 * Represents an acquired file lock.
 *
 * Contains metadata about the lock including the owning process ID and
 * acquisition timestamp. Used with acquireLock and releaseLock functions.
 */
export interface FileLock {
	/** Absolute path to the locked file */
	path: string;
	/** Path to the .lock file that indicates the lock */
	lockPath: string;
	/** Process ID of the lock holder */
	pid: number;
	/** Unix timestamp (milliseconds) when the lock was acquired */
	timestamp: number;
}

// ============================================================================
// Workspace Detection
// ============================================================================

/**
 * Checks if a marker exists at the given directory.
 */
async function markerExistsAt(dir: string, marker: string): Promise<boolean> {
	try {
		const markerPath = join(dir, marker);
		await stat(markerPath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Finds the workspace root by searching upward for marker files/directories.
 *
 * Searches from startPath up to the filesystem root (or stopAt if specified),
 * returning the first directory containing any of the marker files.
 * Default markers are ".git" and "package.json".
 *
 * @param startPath - Path to start searching from (can be file or directory)
 * @param options - Search options including custom markers and stop boundary
 * @returns Result containing absolute workspace root path, or NotFoundError if no markers found
 */
export async function findWorkspaceRoot(
	startPath: string,
	options?: FindWorkspaceRootOptions,
): Promise<Result<string, InstanceType<typeof NotFoundError>>> {
	const markers = options?.markers ?? [".git", "package.json"];
	const stopAt = options?.stopAt;

	let currentDir = resolve(startPath);
	const root = resolve("/");

	while (true) {
		// Check for any marker at this level
		for (const marker of markers) {
			if (await markerExistsAt(currentDir, marker)) {
				return Result.ok(currentDir);
			}
		}

		// Check if we've hit the stop boundary
		if (stopAt && currentDir === resolve(stopAt)) {
			break;
		}

		// Check if we've hit the filesystem root
		if (currentDir === root) {
			break;
		}

		// Move up one directory
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			// Reached root, no more parents
			break;
		}
		currentDir = parentDir;
	}

	return Result.err(
		new NotFoundError({
			message: "No workspace root found",
			resourceType: "workspace",
			resourceId: startPath,
		}),
	);
}

/**
 * Gets the path relative to the workspace root.
 *
 * Finds the workspace root from the file's directory and returns the
 * path relative to that root. Uses forward slashes for cross-platform consistency.
 *
 * @param absolutePath - Absolute path to convert to workspace-relative
 * @returns Result containing relative path with forward slashes, or NotFoundError if no workspace found
 */
export async function getRelativePath(
	absolutePath: string,
): Promise<Result<string, InstanceType<typeof NotFoundError>>> {
	const workspaceResult = await findWorkspaceRoot(dirname(absolutePath));

	if (workspaceResult.isErr()) {
		return workspaceResult;
	}

	const relativePath = relative(workspaceResult.value, absolutePath);
	// Normalize to forward slashes for consistency
	return Result.ok(relativePath.split(sep).join("/"));
}

/**
 * Checks if a path is inside a workspace directory.
 *
 * Resolves both paths to absolute form and checks if path is equal to
 * or a descendant of workspaceRoot. Does not follow symlinks.
 *
 * @param path - Path to check (can be relative or absolute)
 * @param workspaceRoot - Workspace root directory to check against
 * @returns True if path is inside or equal to workspace root, false otherwise
 */
export async function isInsideWorkspace(path: string, workspaceRoot: string): Promise<boolean> {
	const resolvedPath = resolve(path);
	const resolvedRoot = resolve(workspaceRoot);

	// Check if the resolved path starts with the workspace root
	return resolvedPath.startsWith(resolvedRoot + sep) || resolvedPath === resolvedRoot;
}

// ============================================================================
// Path Security
// ============================================================================

/**
 * Validates and secures a user-provided path, preventing path traversal attacks.
 *
 * Security checks performed:
 * - Null bytes are rejected immediately
 * - Path traversal sequences (..) are rejected
 * - Absolute paths are rejected
 * - Final resolved path is verified to remain within basePath (defense in depth)
 *
 * Always use this function when handling user-provided paths instead of
 * directly using path.join with untrusted input.
 *
 * @param path - User-provided path to validate (must be relative)
 * @param basePath - Base directory to resolve against
 * @returns Result containing resolved absolute safe path, or ValidationError if path is unsafe
 */
export function securePath(
	path: string,
	basePath: string,
): Result<string, InstanceType<typeof ValidationError>> {
	// Check for null bytes
	if (path.includes("\x00")) {
		return Result.err(
			new ValidationError({
				message: "Path contains null bytes",
				field: "path",
			}),
		);
	}

	// Normalize backslashes to forward slashes
	const normalizedPath = path.replace(/\\/g, "/");

	// Check for path traversal
	if (normalizedPath.includes("..")) {
		return Result.err(
			new ValidationError({
				message: "Path contains traversal sequence",
				field: "path",
			}),
		);
	}

	// Check for absolute paths
	if (normalizedPath.startsWith("/")) {
		return Result.err(
			new ValidationError({
				message: "Absolute paths are not allowed",
				field: "path",
			}),
		);
	}

	// Remove leading ./ if present
	const cleanPath = normalizedPath.replace(/^\.\//, "");

	// Resolve the final path
	const resolvedPath = join(basePath, cleanPath);

	// Double-check the resolved path is within basePath (defense in depth)
	const normalizedResolved = normalize(resolvedPath);
	const normalizedBase = normalize(basePath);

	if (!normalizedResolved.startsWith(normalizedBase)) {
		return Result.err(
			new ValidationError({
				message: "Path escapes base directory",
				field: "path",
			}),
		);
	}

	return Result.ok(resolvedPath);
}

/**
 * Checks if a path is safe (no traversal, valid characters).
 *
 * Convenience wrapper around securePath that returns a boolean.
 * Use this for quick validation; use securePath when you need the resolved path.
 *
 * @param path - Path to check (should be relative)
 * @param basePath - Base directory to resolve against
 * @returns True if path passes all security checks, false otherwise
 */
export function isPathSafe(path: string, basePath: string): boolean {
	return Result.isOk(securePath(path, basePath));
}

/**
 * Safely resolves path segments into an absolute path.
 *
 * Validates each segment for security issues before joining. Use this
 * instead of path.join when any segment may come from user input.
 *
 * Security checks per segment:
 * - Null bytes are rejected
 * - Path traversal (..) is rejected
 * - Absolute path segments are rejected
 *
 * @param basePath - Base directory (must be absolute)
 * @param segments - Path segments to join (each validated individually)
 * @returns Result containing resolved absolute path, or ValidationError if any segment is unsafe
 */
export function resolveSafePath(
	basePath: string,
	...segments: string[]
): Result<string, InstanceType<typeof ValidationError>> {
	// Check each segment for security issues
	for (const segment of segments) {
		// Check for null bytes
		if (segment.includes("\x00")) {
			return Result.err(
				new ValidationError({
					message: "Path segment contains null bytes",
					field: "path",
				}),
			);
		}

		// Check for path traversal
		if (segment.includes("..")) {
			return Result.err(
				new ValidationError({
					message: "Path segment contains traversal sequence",
					field: "path",
				}),
			);
		}

		// Block absolute segments to prevent path escapes
		if (isAbsolute(segment)) {
			return Result.err(
				new ValidationError({
					message: "Absolute path segments are not allowed",
					field: "path",
				}),
			);
		}
	}

	// Join all segments
	const resolvedPath = join(basePath, ...segments);

	// Verify the resolved path is within basePath using path-boundary check
	const normalizedResolved = normalize(resolvedPath);
	const normalizedBase = normalize(basePath);

	// Use path-boundary check: must equal base or start with base + separator
	if (
		normalizedResolved !== normalizedBase &&
		!normalizedResolved.startsWith(normalizedBase + sep)
	) {
		return Result.err(
			new ValidationError({
				message: "Path escapes base directory",
				field: "path",
			}),
		);
	}

	return Result.ok(resolvedPath);
}

// ============================================================================
// Glob Patterns
// ============================================================================

/**
 * Processes ignore patterns, handling negation patterns.
 * Returns a filtering function that determines if a file should be included.
 */
function createIgnoreFilter(
	ignore: string[] | undefined,
	cwd: string,
): (filePath: string) => boolean {
	if (!ignore || ignore.length === 0) {
		return () => true; // Include all files
	}

	// Separate regular ignore patterns from negation patterns
	const ignorePatterns: string[] = [];
	const negationPatterns: string[] = [];

	for (const pattern of ignore) {
		if (pattern.startsWith("!")) {
			negationPatterns.push(pattern.slice(1));
		} else {
			ignorePatterns.push(pattern);
		}
	}

	return (filePath: string) => {
		// Get relative path for pattern matching
		const relativePath = relative(cwd, filePath);

		// Check if file matches any ignore pattern
		let isIgnored = false;
		for (const pattern of ignorePatterns) {
			const glob = new Bun.Glob(pattern);
			if (glob.match(relativePath)) {
				isIgnored = true;
				break;
			}
		}

		// If ignored, check if it matches any negation pattern (to un-ignore)
		if (isIgnored) {
			for (const pattern of negationPatterns) {
				const glob = new Bun.Glob(pattern);
				if (glob.match(relativePath)) {
					isIgnored = false;
					break;
				}
			}
		}

		return !isIgnored;
	};
}

/**
 * Finds files matching a glob pattern.
 *
 * Uses Bun.Glob internally for fast pattern matching. Returns absolute paths.
 * Supports standard glob syntax including recursive matching, alternation, and character classes.
 *
 * Pattern syntax:
 * - Single asterisk matches any characters except path separator
 * - Double asterisk matches any characters including path separator (recursive)
 * - Curly braces for alternation
 * - Square brackets for character classes
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options including cwd, ignore patterns, and file type filters
 * @returns Result containing array of absolute file paths, or InternalError on failure
 */
export async function glob(
	pattern: string,
	options?: GlobOptions,
): Promise<Result<string[], InstanceType<typeof InternalError>>> {
	try {
		const cwd = options?.cwd ?? process.cwd();
		const bunGlob = new Bun.Glob(pattern);

		const files: string[] = [];
		const ignoreFilter = createIgnoreFilter(options?.ignore, cwd);

		// Use conditional spread for optional boolean properties (exactOptionalPropertyTypes)
		const scanOptions = {
			cwd,
			...(options?.dot !== undefined && { dot: options.dot }),
			...(options?.followSymlinks !== undefined && { followSymlinks: options.followSymlinks }),
		};

		for await (const file of bunGlob.scan(scanOptions)) {
			const absolutePath = join(cwd, file);
			if (ignoreFilter(absolutePath)) {
				files.push(absolutePath);
			}
		}

		return Result.ok(files);
	} catch (error) {
		return Result.err(
			new InternalError({
				message: error instanceof Error ? error.message : "Glob operation failed",
			}),
		);
	}
}

/**
 * Synchronous version of glob.
 *
 * Use the async glob function when possible. This synchronous version
 * blocks the event loop and should only be used in initialization code
 * or synchronous contexts.
 *
 * @param pattern - Glob pattern to match
 * @param options - Glob options including cwd, ignore patterns, and file type filters
 * @returns Result containing array of absolute file paths, or InternalError on failure
 */
export function globSync(
	pattern: string,
	options?: GlobOptions,
): Result<string[], InstanceType<typeof InternalError>> {
	try {
		const cwd = options?.cwd ?? process.cwd();
		const bunGlob = new Bun.Glob(pattern);

		const files: string[] = [];
		const ignoreFilter = createIgnoreFilter(options?.ignore, cwd);

		// Use conditional spread for optional boolean properties (exactOptionalPropertyTypes)
		const scanOptions = {
			cwd,
			...(options?.dot !== undefined && { dot: options.dot }),
			...(options?.followSymlinks !== undefined && { followSymlinks: options.followSymlinks }),
		};

		for (const file of bunGlob.scanSync(scanOptions)) {
			const absolutePath = join(cwd, file);
			if (ignoreFilter(absolutePath)) {
				files.push(absolutePath);
			}
		}

		return Result.ok(files);
	} catch (error) {
		return Result.err(
			new InternalError({
				message: error instanceof Error ? error.message : "Glob operation failed",
			}),
		);
	}
}

// ============================================================================
// File Locking
// ============================================================================

/**
 * Acquires an advisory lock on a file.
 *
 * Creates a .lock file next to the target file with lock metadata (PID, timestamp).
 * Uses atomic file creation (wx flag) to prevent race conditions.
 *
 * Important: This is advisory locking. All processes must cooperate by using
 * these locking APIs. The filesystem does not enforce the lock.
 *
 * Prefer using withLock for automatic lock release.
 *
 * @param path - Absolute path to the file to lock
 * @returns Result containing FileLock on success, or ConflictError if already locked
 */
export async function acquireLock(
	path: string,
): Promise<Result<FileLock, InstanceType<typeof ConflictError>>> {
	const lockPath = `${path}.lock`;

	// Check if lock file already exists
	const lockFile = Bun.file(lockPath);
	if (await lockFile.exists()) {
		return Result.err(
			new ConflictError({
				message: `File is already locked: ${path}`,
			}),
		);
	}

	const lock: FileLock = {
		path,
		lockPath,
		pid: process.pid,
		timestamp: Date.now(),
	};

	// Create lock file with lock information
	try {
		await fsWriteFile(
			lockPath,
			JSON.stringify({ pid: lock.pid, timestamp: lock.timestamp }),
			{ flag: "wx" }, // Fail if file exists (atomic check-and-create)
		);
	} catch (error) {
		// If file already exists (race condition), return conflict error
		if (error instanceof Error && "code" in error && error.code === "EEXIST") {
			return Result.err(
				new ConflictError({
					message: `File is already locked: ${path}`,
				}),
			);
		}
		// Re-throw unexpected errors
		throw error;
	}

	return Result.ok(lock);
}

/**
 * Releases a file lock by removing the .lock file.
 *
 * Should only be called with a lock obtained from acquireLock.
 * Prefer using withLock for automatic lock management.
 *
 * @param lock - Lock object returned from acquireLock
 * @returns Result indicating success, or InternalError if lock file cannot be removed
 */
export async function releaseLock(
	lock: FileLock,
): Promise<Result<void, InstanceType<typeof InternalError>>> {
	try {
		await unlink(lock.lockPath);
		return Result.ok(undefined);
	} catch (error) {
		return Result.err(
			new InternalError({
				message: error instanceof Error ? error.message : "Failed to release lock",
			}),
		);
	}
}

/**
 * Executes a callback while holding an exclusive lock on a file.
 *
 * Lock is automatically released after callback completes, whether it
 * succeeds or throws an error. This is the recommended way to use file locking.
 *
 * Uses advisory file locking via .lock files. The lock is NOT enforced
 * by the filesystem - all processes must cooperate by using this API.
 *
 * @typeParam T - Return type of the callback
 * @param path - Absolute path to the file to lock
 * @param callback - Async callback to execute while holding lock
 * @returns Result containing callback return value, ConflictError if locked, or InternalError on failure
 */
export async function withLock<T>(
	path: string,
	callback: () => Promise<T>,
): Promise<Result<T, InstanceType<typeof ConflictError> | InstanceType<typeof InternalError>>> {
	const lockResult = await acquireLock(path);

	if (lockResult.isErr()) {
		return lockResult;
	}

	const lock = lockResult.value;

	try {
		const result = await callback();
		const releaseResult = await releaseLock(lock);
		// Surface release failures to caller
		if (releaseResult.isErr()) {
			return releaseResult;
		}
		return Result.ok(result);
	} catch (error) {
		// Always attempt to release the lock, even on error
		const releaseResult = await releaseLock(lock);
		// If release also fails, include that in the error
		if (releaseResult.isErr()) {
			return Result.err(
				new InternalError({
					message: `Callback failed: ${error instanceof Error ? error.message : "Unknown error"}; lock release also failed: ${releaseResult.error.message}`,
				}),
			);
		}
		return Result.err(
			new InternalError({
				message: error instanceof Error ? error.message : "Callback failed",
			}),
		);
	}
}

/**
 * Checks if a file is currently locked.
 *
 * Checks for the existence of a .lock file. Does not verify if the
 * process holding the lock is still running (no stale lock detection).
 *
 * @param path - Absolute path to check
 * @returns True if a lock file exists, false otherwise
 */
export async function isLocked(path: string): Promise<boolean> {
	const lockPath = `${path}.lock`;
	return Bun.file(lockPath).exists();
}

// ============================================================================
// Atomic Writes
// ============================================================================

/**
 * Writes content to a file atomically using temp-file-then-rename strategy.
 *
 * How it works:
 * 1. Creates a unique temp file in the same directory
 * 2. Writes content to temp file
 * 3. Renames temp file to target (atomic on most filesystems)
 * 4. Cleans up temp file on failure
 *
 * This prevents partial writes and file corruption. The file either
 * contains the old content or the new content, never a partial state.
 *
 * @param path - Absolute path to target file
 * @param content - String content to write
 * @param options - Write options including directory creation and permission handling
 * @returns Result indicating success, or InternalError on failure
 */
export async function atomicWrite(
	path: string,
	content: string,
	options?: AtomicWriteOptions,
): Promise<Result<void, InstanceType<typeof InternalError>>> {
	const createParentDirs = options?.createParentDirs ?? true;
	const parentDir = dirname(path);
	// Add random suffix for uniqueness in concurrent writes
	const randomSuffix = Math.random().toString(36).slice(2, 10);
	const tempPath = `${path}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;

	try {
		// Create parent directories if needed
		if (createParentDirs) {
			await mkdir(parentDir, { recursive: true });
		}

		// Get existing file permissions if needed
		let mode = options?.mode ?? 0o644;
		if (options?.preservePermissions) {
			try {
				const stats = await stat(path);
				mode = stats.mode;
			} catch {
				// File doesn't exist, use default mode
			}
		}

		// Write to temp file
		await fsWriteFile(tempPath, content, { mode });

		// Rename temp file to target (atomic operation on most filesystems)
		await rename(tempPath, path);

		return Result.ok(undefined);
	} catch (error) {
		// Clean up temp file if it exists
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}

		return Result.err(
			new InternalError({
				message: error instanceof Error ? error.message : "Atomic write failed",
			}),
		);
	}
}

/**
 * Writes JSON data to a file atomically.
 *
 * Serializes data to JSON and writes using atomicWrite.
 * Returns ValidationError if serialization fails.
 *
 * @typeParam T - Type of data to serialize
 * @param path - Absolute path to target file
 * @param data - Data to serialize and write (must be JSON-serializable)
 * @param options - Write options including directory creation and permission handling
 * @returns Result indicating success, ValidationError if serialization fails, or InternalError on write failure
 */
export async function atomicWriteJson<T>(
	path: string,
	data: T,
	options?: AtomicWriteOptions,
): Promise<
	Result<void, InstanceType<typeof InternalError> | InstanceType<typeof ValidationError>>
> {
	try {
		const content = JSON.stringify(data);
		return await atomicWrite(path, content, options);
	} catch (error) {
		return Result.err(
			new ValidationError({
				message: error instanceof Error ? error.message : "Failed to serialize JSON",
				field: "data",
			}),
		);
	}
}
