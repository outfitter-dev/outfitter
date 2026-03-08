/* eslint-disable outfitter/max-file-lines -- Sink factories and formatters are intentionally grouped so logging outputs are easier to trace. */
import { registeredSinks } from "./bridge.js";
import type {
  ConsoleSinkOptions,
  FileSinkOptions,
  Formatter,
  LogLevel,
  LogRecord,
  PrettyFormatterOptions,
  Sink,
} from "./types.js";

// ============================================================================
// Formatters
// ============================================================================

/**
 * Create a JSON formatter for structured log output.
 *
 * @returns Formatter that outputs JSON strings
 *
 * @example
 * ```typescript
 * const formatter = createJsonFormatter();
 * const output = formatter.format(record);
 * // {"timestamp":1705936800000,"level":"info","message":"Hello",...}
 * ```
 */
export function createJsonFormatter(): Formatter {
  return {
    format(record: LogRecord): string {
      const { timestamp, level, category, message, metadata } = record;
      const output: Record<string, unknown> = {
        timestamp,
        level,
        category,
        message,
        ...metadata,
      };
      return JSON.stringify(output);
    },
  };
}

/**
 * Create a human-readable formatter with optional colors.
 *
 * @param options - Formatter options
 * @returns Formatter that outputs human-readable strings
 *
 * @example
 * ```typescript
 * const formatter = createPrettyFormatter({ colors: true });
 * const output = formatter.format(record);
 * // 2024-01-22T12:00:00.000Z [INFO] my-service: Hello world
 * ```
 */
export function createPrettyFormatter(
  options?: PrettyFormatterOptions
): Formatter {
  const useColors = options?.colors ?? false;
  const showTimestamp = options?.timestamp ?? true;

  const ANSI = {
    reset: "\u001b[0m",
    dim: "\u001b[2m",
    yellow: "\u001b[33m",
    red: "\u001b[31m",
    cyan: "\u001b[36m",
    green: "\u001b[32m",
    magenta: "\u001b[35m",
  };

  const levelColors: Record<Exclude<LogLevel, "silent">, string> = {
    trace: ANSI.dim,
    debug: ANSI.cyan,
    info: ANSI.green,
    warn: ANSI.yellow,
    error: ANSI.red,
    fatal: ANSI.magenta,
  };

  return {
    format(record: LogRecord): string {
      const { timestamp, level, category, message, metadata } = record;
      const isoTime = new Date(timestamp).toISOString();
      const levelUpper = level.toUpperCase();

      let output = "";

      if (showTimestamp) {
        output += `${isoTime} `;
      }

      if (useColors) {
        const color = levelColors[level];
        output += `${color}[${levelUpper}]${ANSI.reset} `;
      } else {
        output += `[${levelUpper}] `;
      }

      output += `${category}: ${message}`;

      if (metadata && Object.keys(metadata).length > 0) {
        output += ` ${JSON.stringify(metadata)}`;
      }

      return output;
    },
  };
}

// ============================================================================
// Sinks
// ============================================================================

/**
 * Create a console sink that writes via console methods.
 * Info and below go to console.info/debug, warn and above go to console.warn/error.
 *
 * @param options - Console sink options
 * @returns Sink configured for console output
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "app",
 *   sinks: [createConsoleSink()],
 * });
 *
 * // Disable colors for CI/piped output
 * const plainLogger = createLogger({
 *   name: "app",
 *   sinks: [createConsoleSink({ colors: false })],
 * });
 * ```
 */
export function createConsoleSink(options?: ConsoleSinkOptions): Sink {
  const useColors =
    options?.colors ??
    (typeof process !== "undefined" ? Boolean(process.stdout?.isTTY) : false);
  const formatter =
    options?.formatter ?? createPrettyFormatter({ colors: useColors });

  const sink: Sink = {
    formatter,
    write(record: LogRecord, formatted?: string): void {
      const output = formatted ?? formatter.format(record);
      const outputLine = output.endsWith("\n") ? output.slice(0, -1) : output;
      const runtimeConsole = globalThis["console"];

      if (record.level === "fatal" || record.level === "error") {
        runtimeConsole.error(outputLine);
        return;
      }
      if (record.level === "warn") {
        runtimeConsole.warn(outputLine);
        return;
      }
      if (record.level === "debug" || record.level === "trace") {
        runtimeConsole.debug(outputLine);
        return;
      }
      runtimeConsole.info(outputLine);
    },
  };

  registeredSinks.add(sink);
  return sink;
}

/**
 * Create a file sink that writes to a specified file path.
 *
 * @param options - File sink options
 * @returns Sink configured for file output
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "app",
 *   sinks: [createFileSink({ path: "/var/log/app.log" })],
 * });
 * ```
 */
export function createFileSink(options: FileSinkOptions): Sink {
  const formatter = createJsonFormatter();
  const buffer: string[] = [];
  const { path } = options;
  // append defaults to true
  const append = options.append ?? true;
  let cachedContent = append ? null : "";

  const sink: Sink = {
    formatter,
    write(record: LogRecord, formatted?: string): void {
      const output = formatted ?? formatter.format(record);
      const outputWithNewline = output.endsWith("\n") ? output : `${output}\n`;
      buffer.push(outputWithNewline);
    },
    async flush(): Promise<void> {
      if (buffer.length > 0) {
        const content = buffer.join("");
        buffer.length = 0;

        if (append) {
          const file = Bun.file(path);
          const existing = (await file.exists()) ? await file.text() : "";
          await Bun.write(path, existing + content);
          return;
        }

        cachedContent = (cachedContent ?? "") + content;
        await Bun.write(path, cachedContent);
      }
    },
  };

  registeredSinks.add(sink);
  return sink;
}

// ============================================================================
// Flush
// ============================================================================

/**
 * Flush all sinks in a collection (internal helper).
 */
export async function flushSinks(sinks: Iterable<Sink>): Promise<void> {
  const flushPromises: Promise<void>[] = [];

  for (const sink of sinks) {
    if (sink.flush) {
      flushPromises.push(
        sink.flush().catch(() => {
          // Flush is best-effort; one sink failure should not block others.
        })
      );
    }
  }

  await Promise.all(flushPromises);
}

/**
 * Flush all pending log writes across all sinks.
 * Call this before process exit to ensure all logs are written.
 *
 * @returns Promise that resolves when all sinks have flushed
 *
 * @example
 * ```typescript
 * logger.info("Shutting down");
 * await flush();
 * process.exit(0);
 * ```
 */
export async function flush(): Promise<void> {
  await flushSinks(registeredSinks);
}
