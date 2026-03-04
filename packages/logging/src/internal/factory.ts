import {
  type LoggerAdapter as ContractLoggerAdapter,
  type LoggerFactory as ContractLoggerFactory,
  type LoggerFactoryConfig as ContractLoggerFactoryConfig,
  createLoggerFactory as createContractLoggerFactory,
} from "@outfitter/contracts";

import { resolveOutfitterLogLevel } from "./env.js";
import { createLogger } from "./logger.js";
import { mergeRedactionConfig } from "./redaction.js";
import { createConsoleSink, flushSinks } from "./sinks.js";
import type {
  LoggerConfig,
  OutfitterLoggerBackendOptions,
  OutfitterLoggerFactoryOptions,
  Sink,
} from "./types.js";

/**
 * Outfitter logger adapter contract type.
 */
export type OutfitterLoggerAdapter =
  ContractLoggerAdapter<OutfitterLoggerBackendOptions>;

/**
 * Outfitter logger factory contract type.
 */
export type OutfitterLoggerFactory =
  ContractLoggerFactory<OutfitterLoggerBackendOptions>;

/**
 * Create an Outfitter logger adapter with environment defaults and redaction.
 *
 * Defaults:
 * - log level resolution via `resolveOutfitterLogLevel()`
 * - redaction enabled by default (`enabled: true`)
 * - console sink when no explicit sinks are provided
 */
export function createOutfitterLoggerAdapter(
  options?: OutfitterLoggerFactoryOptions
): OutfitterLoggerAdapter {
  const factorySinks = new Set<Sink>();

  return {
    createLogger(
      config: ContractLoggerFactoryConfig<OutfitterLoggerBackendOptions>
    ) {
      const backend = config.backend;
      const sinks = backend?.sinks ??
        options?.defaults?.sinks ?? [createConsoleSink()];
      const defaultRedaction = mergeRedactionConfig(
        { enabled: true },
        options?.defaults?.redaction
      );
      const redaction = mergeRedactionConfig(
        defaultRedaction,
        backend?.redaction
      );

      const loggerConfig: LoggerConfig = {
        name: config.name,
        level: resolveOutfitterLogLevel(config.level),
        sinks,
        ...(config.context !== undefined ? { context: config.context } : {}),
        ...(redaction !== undefined ? { redaction } : {}),
      };

      for (const sink of sinks) {
        factorySinks.add(sink);
      }

      const logger = createLogger(loggerConfig);
      const originalAddSink = logger.addSink.bind(logger);
      logger.addSink = (sink) => {
        factorySinks.add(sink);
        originalAddSink(sink);
      };

      return logger;
    },
    async flush() {
      await flushSinks(factorySinks);
    },
  };
}

/**
 * Create an Outfitter logger factory over the contracts logger abstraction.
 */
export function createOutfitterLoggerFactory(
  options?: OutfitterLoggerFactoryOptions
): OutfitterLoggerFactory {
  return createContractLoggerFactory(createOutfitterLoggerAdapter(options));
}
