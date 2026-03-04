/**
 * Type definitions for IPC communication.
 *
 * Defines the public and internal message types used by
 * the IPC server and client implementations.
 *
 * @packageDocumentation
 */

// ============================================================================
// Public Types
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
   * Stop listening and close all connections.
   *
   * Removes the socket file and cleans up resources.
   */
  close(): Promise<void>;
  /**
   * Start listening for connections on the Unix socket.
   *
   * Creates the socket file and begins accepting client connections.
   * Messages are processed using the handler registered via onMessage.
   */
  listen(): Promise<void>;

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
   * Close the connection to the server.
   *
   * Can be called multiple times safely.
   */
  close(): void;
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
}

// ============================================================================
// Internal Types
// ============================================================================

/** Wire format for IPC messages exchanged between server and client. */
export interface IpcMessage {
  id: string;
  payload: unknown;
  type: "request" | "response" | "error";
}

/** Tracks an in-flight client request awaiting a server response. */
export interface PendingRequest {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
}
