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
 */
export interface FindWorkspaceRootOptions {
	/** Marker files/directories to search for (default: [".git", "package.json"]) */
	markers?: string[];
	/** Stop searching at this directory (default: filesystem root) */
	stopAt?: string;
}

/**
 * Options for glob operations.
 */
export interface GlobOptions {
	/** Base directory for glob matching */
	cwd?: string;
	/** Patterns to exclude from results */
	ignore?: string[];
	/** Follow symlinks (default: false) */
	followSymlinks?: boolean;
	/** Include dot files (default: false) */
	dot?: boolean;
}

/**
 * Options for atomic write operations.
 */
export interface AtomicWriteOptions {
	/** Create parent directories if they don't exist (default: true) */
	createParentDirs?: boolean;
	/** Preserve file permissions from existing file (default: false) */
	preservePermissions?: boolean;
	/** File mode for new files (default: 0o644) */
	mode?: number;
}

/**
 * Represents an acquired file lock.
 */
export interface FileLock {
	/** Path to the locked file */
	path: string;
	/** Path to the lock file */
	lockPath: string;
	/** Process ID that holds the lock */
	pid: number;
	/** Timestamp when lock was acquired */
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
 * Finds the workspace root by searching for marker files/directories.
 *
 * @param startPath - Path to start searching from
 * @param options - Search options
 * @returns Result containing workspace root path or NotFoundError
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
 * @param absolutePath - Absolute path to convert
 * @returns Result containing relative path or error
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
 * @param path - Path to check
 * @param workspaceRoot - Workspace root directory
 * @returns True if path is inside workspace
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
 * Validates and secures a path, preventing path traversal attacks.
 *
 * @param path - Path to validate
 * @param basePath - Base directory to resolve against
 * @returns Result containing resolved safe path or ValidationError
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
 * @param path - Path to check
 * @param basePath - Base directory to resolve against
 * @returns True if path is safe
 */
export function isPathSafe(path: string, basePath: string): boolean {
	return Result.isOk(securePath(path, basePath));
}

/**
 * Safely resolves path segments into an absolute path.
 *
 * @param basePath - Base directory
 * @param segments - Path segments to join
 * @returns Result containing resolved path or ValidationError
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
 * @param pattern - Glob pattern to match
 * @param options - Glob options
 * @returns Result containing array of matching file paths
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
 * @param pattern - Glob pattern to match
 * @param options - Glob options
 * @returns Result containing array of matching file paths
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
 * @param path - Path to the file to lock
 * @returns Result containing FileLock or ConflictError if already locked
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
 * Releases a file lock.
 *
 * @param lock - Lock to release
 * @returns Result indicating success or error
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
 * Executes a callback while holding a lock on a file.
 * Lock is automatically released after callback completes (success or error).
 *
 * @param path - Path to the file to lock
 * @param callback - Callback to execute while holding lock
 * @returns Result containing callback return value or error
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
 * @param path - Path to check
 * @returns True if file is locked
 */
export async function isLocked(path: string): Promise<boolean> {
	const lockPath = `${path}.lock`;
	return Bun.file(lockPath).exists();
}

// ============================================================================
// Atomic Writes
// ============================================================================

/**
 * Writes content to a file atomically (write to temp, then rename).
 *
 * @param path - Target file path
 * @param content - Content to write
 * @param options - Write options
 * @returns Result indicating success or error
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
 * @param path - Target file path
 * @param data - Data to serialize and write
 * @param options - Write options
 * @returns Result indicating success or error
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
