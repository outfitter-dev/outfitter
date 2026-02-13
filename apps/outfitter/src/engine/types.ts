import type { AddBlockResult } from "@outfitter/tooling";

/**
 * Unified placeholder values for template substitution.
 */
export interface PlaceholderValues {
  readonly name: string;
  readonly projectName: string;
  readonly packageName: string;
  readonly binName: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly year: string;
}

/**
 * A single change operation in a scaffold plan.
 */
export type ScaffoldChange =
  | {
      readonly type: "copy-template";
      readonly template: string;
      readonly targetDir: string;
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
  readonly values: PlaceholderValues;
  readonly changes: readonly ScaffoldChange[];
}

/**
 * Result of executing a scaffold plan.
 */
export interface ScaffoldResult {
  readonly projectDir: string;
  readonly blocksAdded?: AddBlockResult | undefined;
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
  readonly force: boolean;
  readonly collector?: EngineCollector | undefined;
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
