/**
 * @outfitter/index - Migration utilities
 *
 * Minimal migration registry for index version upgrades.
 *
 * @packageDocumentation
 */

import type { Database } from "bun:sqlite";
import type { StorageError } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";

export interface MigrationRegistry<TContext> {
  register(
    fromVersion: number,
    toVersion: number,
    migrate: (context: TContext) => Result<void, StorageError>
  ): void;
  migrate(
    context: TContext,
    fromVersion: number,
    toVersion: number
  ): Result<void, StorageError>;
}

export interface IndexMigrationContext {
  readonly db: Database;
}

export type IndexMigrationRegistry = MigrationRegistry<IndexMigrationContext>;

function createStorageError(message: string, cause?: unknown): StorageError {
  return {
    _tag: "StorageError",
    message,
    cause,
  };
}

export function createMigrationRegistry<
  TContext,
>(): MigrationRegistry<TContext> {
  const steps = new Map<
    number,
    { to: number; migrate: (context: TContext) => Result<void, StorageError> }
  >();

  return {
    register(fromVersion, toVersion, migrate) {
      steps.set(fromVersion, { to: toVersion, migrate });
    },
    migrate(context, fromVersion, toVersion) {
      if (fromVersion === toVersion) {
        return Result.ok(undefined);
      }

      let current = fromVersion;
      const visited = new Set<number>();

      while (current < toVersion) {
        if (visited.has(current)) {
          return Result.err(
            createStorageError(`Detected migration loop at version ${current}`)
          );
        }
        visited.add(current);

        const step = steps.get(current);
        if (!step) {
          return Result.err(
            createStorageError(
              `No migration registered from version ${current}`
            )
          );
        }

        const result = step.migrate(context);
        if (result.isErr()) {
          return result;
        }

        current = step.to;
      }

      if (current !== toVersion) {
        return Result.err(
          createStorageError(
            `Migration ended at version ${current} instead of ${toVersion}`
          )
        );
      }

      return Result.ok(undefined);
    },
  };
}
