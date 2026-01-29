/**
 * Streaming module for @outfitter/cli.
 *
 * Provides primitives for in-place terminal updates, animated spinners,
 * and ANSI escape sequences.
 *
 * @example
 * ```typescript
 * import { createSpinner, createStreamWriter, ANSI } from "@outfitter/cli/streaming";
 *
 * // Spinner for async operations
 * const spinner = createSpinner("Loading...");
 * spinner.start();
 * await doWork();
 * spinner.succeed("Done!");
 *
 * // Stream writer for custom updates
 * const writer = createStreamWriter();
 * writer.write("Progress: 0%");
 * writer.update("Progress: 50%");
 * writer.update("Progress: 100%");
 * writer.persist();
 * ```
 *
 * @packageDocumentation
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-exports for subpath API
export { ANSI } from "./ansi.js";
export {
  createSpinner,
  type Spinner,
  type SpinnerOptions,
  type SpinnerStyle,
} from "./spinner.js";
export {
  createStreamWriter,
  type StreamWriter,
  type StreamWriterOptions,
  type WritableStream,
} from "./writer.js";
