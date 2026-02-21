import type { AddBlockResult } from "@outfitter/tooling";

/**
 * Unified placeholder values for template substitution.
 */
export interface PlaceholderValues {
  readonly author: string;
  readonly binName: string;
  readonly description: string;
  readonly name: string;
  readonly packageName: string;
  readonly projectName: string;
  readonly version: string;
  readonly year: string;
}

/**
 * A single change operation in a scaffold plan.
 */
export type ScaffoldChange =
  | {
      readonly type: "copy-preset";
      readonly preset: string;
      readonly targetDir: string;
      readonly includeTooling: boolean;
      readonly overlayBaseTemplate: boolean;
    }
  | {
      readonly type: "inject-shared-config";
    }
  | {
      readonly type: "rewrite-local-dependencies";
      readonly mode: "workspace";
    }
  | {
      readonly type: "add-blocks";
      readonly blocks: readonly string[];
    };

/**
 * A complete scaffold plan.
 */
export interface ScaffoldPlan {
  readonly changes: readonly ScaffoldChange[];
  readonly values: PlaceholderValues;
}

/**
 * Result of executing a scaffold plan.
 */
export interface ScaffoldResult {
  readonly blocksAdded?: AddBlockResult | undefined;
  readonly projectDir: string;
}

/**
 * Dry-run collector support.
 */
export interface EngineCollector {
  add(op: unknown): void;
}

/**
 * Shared options used by engine functions.
 */
export interface EngineOptions {
  readonly collector?: EngineCollector | undefined;
  readonly force: boolean;
}

/**
 * Unified error type for engine operations.
 */
export class ScaffoldError extends Error {
  readonly _tag = "ScaffoldError" as const;

  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}
