/**
 * Inter-process communication (IPC) via Unix sockets.
 *
 * Provides server and client implementations for daemon IPC using
 * JSON-serialized messages over Unix domain sockets.
 *
 * @packageDocumentation
 */

import { unlink } from "node:fs/promises";
import type { Socket } from "bun";

// ============================================================================
// Types
// ============================================================================

/**
 * Message handler type for processing incoming IPC messages.
 *
 * Receives a parsed message and returns a response to send back to the client.
 * Throwing an error will result in an error response to the client.
 */
export type IpcMessageHandler = (message: unknown) => Promise<unknown>;

/**
 * IPC server interface for receiving messages from clients.
 *
 * The server listens on a Unix socket and processes incoming messages
 * using the registered message handler.
 *
 * @example
 * ```typescript
 * const server = createIpcServer("/var/run/my-daemon.sock");
 *
 * server.onMessage(async (msg) => {
 *   if (msg.type === "status") {
 *     return { status: "ok", uptime: process.uptime() };
 *   }
 *   return { error: "Unknown command" };
 * });
 *
 * await server.listen();
 * ```
 */
export interface IpcServer {
  /**
   * Start listening for connections on the Unix socket.
   *
   * Creates the socket file and begins accepting client connections.
   * Messages are processed using the handler registered via onMessage.
   */
  listen(): Promise<void>;

  /**
   * Stop listening and close all connections.
   *
   * Removes the socket file and cleans up resources.
   */
  close(): Promise<void>;

  /**
   * Register a message handler for incoming messages.
   *
   * Only one handler can be registered. Calling this multiple times
   * replaces the previous handler.
   *
   * @param handler - Function to process incoming messages
   */
  onMessage(handler: IpcMessageHandler): void;
}

/**
 * IPC client interface for sending messages to a server.
 *
 * The client connects to a Unix socket and can send messages,
 * receiving responses asynchronously.
 *
 * @example
 * ```typescript
 * const client = createIpcClient("/var/run/my-daemon.sock");
 *
 * await client.connect();
 *
 * const response = await client.send<StatusResponse>({ type: "status" });
 * console.log("Daemon uptime:", response.uptime);
 *
 * client.close();
 * ```
 */
export interface IpcClient {
  /**
   * Connect to the IPC server.
   *
   * Establishes a connection to the Unix socket. Throws if the
   * server is not available.
   */
  connect(): Promise<void>;

  /**
   * Send a message and wait for a response.
   *
   * Serializes the message to JSON, sends it to the server, and
   * waits for a response.
   *
   * @typeParam T - Expected response type
   * @param message - Message to send (must be JSON-serializable)
   * @returns Promise resolving to the server's response
   * @throws Error if not connected or communication fails
   */
  send<T>(message: unknown): Promise<T>;

  /**
   * Close the connection to the server.
   *
   * Can be called multiple times safely.
   */
  close(): void;
}

// ============================================================================
// Internal Types
// ============================================================================

interface IpcMessage {
  id: string;
  type: "request" | "response" | "error";
  payload: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// IPC Server Implementation
// ============================================================================

/**
 * Create an IPC server listening on a Unix socket.
 *
 * @param socketPath - Path to the Unix socket file
 * @returns IpcServer instance
 *
 * @example
 * ```typescript
 * const server = createIpcServer("/var/run/my-daemon.sock");
 *
 * server.onMessage(async (msg) => {
 *   return { echo: msg };
 * });
 *
 * await server.listen();
 * // Server is now accepting connections
 * ```
 */
export function createIpcServer(socketPath: string): IpcServer {
  let messageHandler: IpcMessageHandler | null = null;
  let server: ReturnType<typeof Bun.listen> | null = null;
  let isListening = false;

  // Per-connection message buffers (Unix sockets don't preserve message boundaries)
  const socketBuffers = new WeakMap<Socket<unknown>, string>();

  function processSocketBuffer(socket: Socket<unknown>): void {
    const buffer = socketBuffers.get(socket) ?? "";
    const lines = buffer.split("\n");
    // Keep the last incomplete line in the buffer
    socketBuffers.set(socket, lines.pop() ?? "");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as IpcMessage;

        if (message.type === "request" && messageHandler) {
          void (async () => {
            try {
              const result = await messageHandler(message.payload);
              const response: IpcMessage = {
                id: message.id,
                type: "response",
                payload: result,
              };
              socket.write(`${JSON.stringify(response)}\n`);
            } catch (error) {
              const errorResponse: IpcMessage = {
                id: message.id,
                type: "error",
                payload: {
                  message:
                    error instanceof Error ? error.message : "Unknown error",
                },
              };
              socket.write(`${JSON.stringify(errorResponse)}\n`);
            }
          })();
        }
      } catch {
        // Ignore malformed messages
      }
    }
  }

  return {
    async listen(): Promise<void> {
      if (isListening) return;

      // Remove existing socket file if present
      try {
        await unlink(socketPath);
      } catch {
        // Ignore if doesn't exist
      }

      server = Bun.listen({
        unix: socketPath,
        socket: {
          data(socket, data) {
            // Convert Buffer to string (Bun's socket data is a Buffer)
            const text = Buffer.isBuffer(data)
              ? data.toString("utf-8")
              : String(data);

            // Accumulate data in per-connection buffer
            const currentBuffer = socketBuffers.get(socket) ?? "";
            socketBuffers.set(socket, currentBuffer + text);

            // Process any complete messages
            processSocketBuffer(socket);
          },
          open(socket) {
            // Initialize buffer for new connection
            socketBuffers.set(socket, "");
          },
          close(socket) {
            // Clean up buffer (WeakMap will GC, but explicit delete is cleaner)
            socketBuffers.delete(socket);
          },
          error() {
            // Connection error - silent no-op, cleanup handled by close()
          },
        },
      });

      isListening = true;
    },

    async close(): Promise<void> {
      if (!isListening) return;

      server?.stop();
      server = null;
      isListening = false;

      // Remove socket file
      try {
        await unlink(socketPath);
      } catch {
        // Ignore if doesn't exist
      }
    },

    onMessage(handler: IpcMessageHandler): void {
      messageHandler = handler;
    },
  };
}

// ============================================================================
// IPC Client Implementation
// ============================================================================

/**
 * Create an IPC client for connecting to a server.
 *
 * @param socketPath - Path to the Unix socket file
 * @returns IpcClient instance
 *
 * @example
 * ```typescript
 * const client = createIpcClient("/var/run/my-daemon.sock");
 *
 * await client.connect();
 * const response = await client.send({ command: "status" });
 * console.log(response);
 * client.close();
 * ```
 */
export function createIpcClient(socketPath: string): IpcClient {
  let socket: Socket<undefined> | null = null;
  let isConnected = false;
  const pendingRequests = new Map<string, PendingRequest>();
  let messageBuffer = "";

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function processBuffer(): void {
    const lines = messageBuffer.split("\n");
    // Keep the last incomplete line in the buffer
    messageBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as IpcMessage;
        const pending = pendingRequests.get(message.id);

        if (pending) {
          pendingRequests.delete(message.id);

          if (message.type === "response") {
            pending.resolve(message.payload);
          } else if (message.type === "error") {
            const errorPayload = message.payload as { message: string };
            pending.reject(new Error(errorPayload.message));
          }
        }
      } catch {
        // Ignore malformed messages
      }
    }
  }

  function rejectAllPending(): void {
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }
  }

  return {
    connect(): Promise<void> {
      if (isConnected && socket) return Promise.resolve();

      // Reset state for reconnection
      messageBuffer = "";

      return new Promise((resolve, reject) => {
        try {
          // Bun.connect returns a Promise, but we get the socket in the open handler
          void Bun.connect({
            unix: socketPath,
            socket: {
              data(_socket, data) {
                // Convert Buffer to string (Bun's socket data is a Buffer)
                const text = Buffer.isBuffer(data)
                  ? data.toString("utf-8")
                  : String(data);
                messageBuffer += text;
                processBuffer();
              },
              open(_socket) {
                isConnected = true;
                socket = _socket;
                resolve();
              },
              close() {
                isConnected = false;
                socket = null;
                rejectAllPending();
              },
              error(_socket, error) {
                isConnected = false;
                socket = null;
                reject(error);
              },
              connectError(_socket, error) {
                isConnected = false;
                socket = null;
                reject(error);
              },
            },
          });
        } catch (error) {
          reject(error);
        }
      });
    },

    send<T>(message: unknown): Promise<T> {
      if (!(isConnected && socket)) {
        return Promise.reject(new Error("Not connected to server"));
      }

      const id = generateId();
      const request: IpcMessage = {
        id,
        type: "request",
        payload: message,
      };

      return new Promise<T>((resolve, reject) => {
        pendingRequests.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });

        try {
          const written = socket?.write(`${JSON.stringify(request)}\n`);
          if (written === 0) {
            pendingRequests.delete(id);
            reject(new Error("Failed to write to socket"));
          }
        } catch (error) {
          pendingRequests.delete(id);
          reject(error);
        }
      });
    },

    close(): void {
      if (!(isConnected && socket)) return;

      try {
        socket?.terminate();
      } catch {
        // Ignore errors during close
      }
      socket = null;
      isConnected = false;
      rejectAllPending();
    },
  };
}
