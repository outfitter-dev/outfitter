/**
 * @outfitter/daemon
 *
 * Daemon lifecycle utilities for Outfitter.
 *
 * @packageDocumentation
 */

export { createDaemon } from "./lifecycle.js";
export { DaemonError } from "./types.js";
export type {
	Daemon,
	DaemonErrorCode,
	DaemonOptions,
	DaemonState,
	ShutdownHandler,
} from "./types.js";
