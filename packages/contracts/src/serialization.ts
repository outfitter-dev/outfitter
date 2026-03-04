/**
 * Serialization utilities for errors and JSON.
 *
 * Provides error serialization/deserialization for transport across process
 * boundaries (MCP, IPC, HTTP), and safe JSON stringify/parse wrappers that
 * handle edge cases (circular references, BigInt, sensitive data) and return
 * Result types instead of throwing.
 *
 * @module serialization
 */

// Error serialization
export type { SerializeErrorOptions } from "./internal/error-serialization.js";
export {
  deserializeError,
  serializeError,
} from "./internal/error-serialization.js";

// Safe JSON utilities
export { safeParse, safeStringify } from "./internal/safe-json.js";
