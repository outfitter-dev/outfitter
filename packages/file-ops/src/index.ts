/**
 * @outfitter/file-ops
 *
 * Workspace detection, secure path handling, glob patterns, file locking,
 * and atomic write utilities. Provides safe file system operations with
 * path traversal protection and cross-process coordination.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type {
  AtomicWriteOptions,
  FileLock,
  FindWorkspaceRootOptions,
  GlobOptions,
  LockOptions,
  SharedFileLock,
} from "./internal/types.js";

// ============================================================================
// Workspace Detection
// ============================================================================

export {
  findWorkspaceRoot,
  getRelativePath,
  isInsideWorkspace,
} from "./internal/workspace.js";

// ============================================================================
// Path Security
// ============================================================================

export {
  isPathSafe,
  resolveSafePath,
  securePath,
} from "./internal/security.js";

// ============================================================================
// Glob Patterns
// ============================================================================

export { glob, globSync } from "./internal/glob.js";

// ============================================================================
// File Locking
// ============================================================================

export {
  acquireLock,
  isLocked,
  releaseLock,
  withLock,
} from "./internal/locking.js";

// ============================================================================
// Shared (Reader) Locking
// ============================================================================

export {
  acquireSharedLock,
  releaseSharedLock,
  withSharedLock,
} from "./internal/shared-locking.js";

// ============================================================================
// Atomic Writes
// ============================================================================

export { atomicWrite, atomicWriteJson } from "./internal/atomic-write.js";
