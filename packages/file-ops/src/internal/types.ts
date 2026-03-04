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
   * Include files and directories starting with a dot in results.
   * @defaultValue false
   */
  dot?: boolean;
  /**
   * Follow symbolic links when scanning directories.
   * @defaultValue false
   */
  followSymlinks?: boolean;
  /**
   * Patterns to exclude from results.
   * Supports negation with "!" prefix to re-include previously excluded files.
   */
  ignore?: string[];
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
   * Unix file mode for newly created files.
   * @defaultValue 0o644
   */
  mode?: number;
  /**
   * Preserve file permissions from existing file.
   * If the target file does not exist, falls back to the mode option.
   * @defaultValue false
   */
  preservePermissions?: boolean;
}

/**
 * Represents an acquired file lock.
 *
 * Contains metadata about the lock including the owning process ID and
 * acquisition timestamp. Used with acquireLock and releaseLock functions.
 */
export interface FileLock {
  /** Path to the .lock file that indicates the lock */
  lockPath: string;
  /** Absolute path to the locked file */
  path: string;
  /** Process ID of the lock holder */
  pid: number;
  /** Unix timestamp (milliseconds) when the lock was acquired */
  timestamp: number;
}

/**
 * Represents an acquired shared (reader) file lock.
 *
 * Extends FileLock with a lock type discriminator. Multiple processes can
 * hold shared locks simultaneously, but shared locks block exclusive locks.
 */
export interface SharedFileLock extends FileLock {
  /** Discriminator indicating this is a shared/reader lock */
  lockType: "shared";
  /** Unique identifier for this reader (allows multiple readers from same PID) */
  readerId: string;
}

/**
 * Options for lock acquisition.
 */
export interface LockOptions {
  /**
   * Interval in milliseconds between retry attempts when waiting.
   * @defaultValue 50
   */
  retryInterval?: number;
  /**
   * Maximum time in milliseconds to wait for lock acquisition.
   * If not specified, fails immediately if lock cannot be acquired.
   */
  timeout?: number;
}

/**
 * Internal type for exclusive lock file content.
 */
export interface ExclusiveLockData {
  pid: number;
  timestamp: number;
  type: "exclusive";
}

/**
 * Internal type for shared lock reader entry.
 */
export interface SharedLockReader {
  id: string;
  pid: number;
  timestamp: number;
}

/**
 * Internal type for shared lock file content.
 */
export interface SharedLockData {
  readers: SharedLockReader[];
  type: "shared";
}

/**
 * Union type for lock file content.
 */
export type LockData = ExclusiveLockData | SharedLockData;
