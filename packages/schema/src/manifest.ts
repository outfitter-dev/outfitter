/**
 * Manifest generation from action registries.
 *
 * Generates machine-readable manifests describing all registered actions,
 * their schemas, surfaces, and metadata. Used by both CLI `schema` command
 * and build-time surface map generation.
 *
 * @packageDocumentation
 */

import {
  ACTION_SURFACES,
  type ActionRegistry,
  type ActionSurface,
  type AnyActionSpec,
  DEFAULT_REGISTRY_SURFACES,
  type ErrorCategory,
  exitCodeMap,
  type JsonSchema,
  statusCodeMap,
  zodToJsonSchema,
} from "@outfitter/contracts";

// =============================================================================
// Types
// =============================================================================

export interface ActionManifest {
  readonly version: string;
  readonly generatedAt: string;
  readonly surfaces: ActionSurface[];
  readonly actions: ActionManifestEntry[];
  readonly errors: Record<ErrorCategory, { exit: number; http: number }>;
  readonly outputModes: string[];
}

export interface ActionManifestEntry {
  readonly id: string;
  readonly description?: string | undefined;
  readonly surfaces: ActionSurface[];
  readonly input: JsonSchema;
  readonly output?: JsonSchema | undefined;
  readonly cli?: ManifestCliSpec | undefined;
  readonly mcp?: ManifestMcpSpec | undefined;
  readonly api?: ManifestApiSpec | undefined;
}

export interface ManifestCliSpec {
  readonly group?: string | undefined;
  readonly command?: string | undefined;
  readonly description?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  readonly options?: readonly ManifestCliOption[] | undefined;
}

export interface ManifestCliOption {
  readonly flags: string;
  readonly description: string;
  readonly defaultValue?: string | boolean | string[] | undefined;
  readonly required?: boolean | undefined;
}

export interface ManifestMcpSpec {
  readonly tool?: string | undefined;
  readonly description?: string | undefined;
  readonly deferLoading?: boolean | undefined;
}

export interface ManifestApiSpec {
  readonly method?: string | undefined;
  readonly path?: string | undefined;
  readonly tags?: readonly string[] | undefined;
}

export interface GenerateManifestOptions {
  readonly surface?: ActionSurface;
  readonly version?: string;
}

// =============================================================================
// Manifest Generation
// =============================================================================

export type ActionSource = ActionRegistry | readonly AnyActionSpec[];

function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return (
    "list" in source && typeof (source as ActionRegistry).list === "function"
  );
}

const OUTPUT_MODES = ["human", "json", "jsonl", "tree", "table"] as const;

function buildErrorTaxonomy(): Record<
  ErrorCategory,
  { exit: number; http: number }
> {
  const taxonomy = {} as Record<ErrorCategory, { exit: number; http: number }>;
  for (const category of Object.keys(exitCodeMap) as ErrorCategory[]) {
    taxonomy[category] = {
      exit: exitCodeMap[category],
      http: statusCodeMap[category],
    };
  }
  return taxonomy;
}

function actionToManifestEntry(action: AnyActionSpec): ActionManifestEntry {
  const surfaces = [
    ...(action.surfaces ?? DEFAULT_REGISTRY_SURFACES),
  ] as ActionSurface[];

  return {
    id: action.id,
    description: action.description,
    surfaces,
    input: zodToJsonSchema(action.input),
    output: action.output ? zodToJsonSchema(action.output) : undefined,
    cli: action.cli
      ? {
          group: action.cli.group,
          command: action.cli.command,
          description: action.cli.description,
          aliases:
            action.cli.aliases && action.cli.aliases.length > 0
              ? action.cli.aliases
              : undefined,
          options:
            action.cli.options && action.cli.options.length > 0
              ? action.cli.options.map((o) => ({
                  flags: o.flags,
                  description: o.description,
                  defaultValue: o.defaultValue,
                  required: o.required,
                }))
              : undefined,
        }
      : undefined,
    mcp: action.mcp
      ? {
          tool: action.mcp.tool,
          description: action.mcp.description,
          deferLoading: action.mcp.deferLoading,
        }
      : undefined,
    api: action.api
      ? {
          method: action.api.method,
          path: action.api.path,
          tags: action.api.tags,
        }
      : undefined,
  };
}

/**
 * Generate a manifest from an action registry or action array.
 *
 * @param source - ActionRegistry or array of ActionSpec
 * @param options - Filtering and version options
 * @returns The manifest object
 */
export function generateManifest(
  source: ActionSource,
  options?: GenerateManifestOptions
): ActionManifest {
  let actions = isActionRegistry(source) ? source.list() : [...source];

  if (options?.surface) {
    const surface = options.surface;
    actions = actions.filter((action) => {
      const surfaces = action.surfaces ?? DEFAULT_REGISTRY_SURFACES;
      return surfaces.includes(surface);
    });
  }

  const surfaceSet = new Set<ActionSurface>();
  for (const action of actions) {
    for (const s of action.surfaces ?? DEFAULT_REGISTRY_SURFACES) {
      if (ACTION_SURFACES.includes(s)) {
        surfaceSet.add(s);
      }
    }
  }

  return {
    version: options?.version ?? "1.0.0",
    generatedAt: new Date().toISOString(),
    surfaces: [...surfaceSet].sort(),
    actions: actions.map(actionToManifestEntry),
    errors: buildErrorTaxonomy(),
    outputModes: [...OUTPUT_MODES],
  };
}
