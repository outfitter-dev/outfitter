/**
 * Inter-process communication (IPC) via Unix sockets.
 *
 * Provides server and client implementations for daemon IPC using
 * JSON-serialized messages over Unix domain sockets.
 *
 * @packageDocumentation
 */

export type {
  IpcClient,
  IpcMessageHandler,
  IpcServer,
} from "./internal/ipc-types.js";
export { createIpcClient } from "./internal/ipc-client.js";
export { createIpcServer } from "./internal/ipc-server.js";
