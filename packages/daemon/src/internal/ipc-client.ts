/**
 * IPC client implementation using Unix domain sockets.
 *
 * @packageDocumentation
 */

import type { Socket } from "bun";

import type { IpcClient, IpcMessage, PendingRequest } from "./ipc-types.js";

/** Generate a unique request ID for correlating requests with responses. */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
