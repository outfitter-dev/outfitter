/**
 * IPC server implementation using Unix domain sockets.
 *
 * @packageDocumentation
 */

import { unlink } from "node:fs/promises";

import type { Socket } from "bun";

import type { IpcMessage, IpcMessageHandler, IpcServer } from "./ipc-types.js";

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
