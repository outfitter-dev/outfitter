import type {
  ActionRegistry,
  ActionSurface,
  AnyActionSpec,
} from "@outfitter/contracts";
import { DEFAULT_REGISTRY_SURFACES } from "@outfitter/contracts";

import { defineTool } from "./server.js";
import type { ToolAnnotations, ToolDefinition } from "./types.js";

export interface BuildMcpToolsOptions {
  readonly includeSurfaces?: readonly ActionSurface[];
}

type ActionSource = ActionRegistry | readonly AnyActionSpec[];

function isActionRegistry(source: ActionSource): source is ActionRegistry {
  return "list" in source;
}

/**
 * Build MCP tool annotations from action MCP spec metadata.
 * Maps readOnly → readOnlyHint, idempotent → idempotentHint.
 * Returns undefined when no metadata signals are set (or all are false).
 */
function buildAnnotations(
  mcp:
    | { readonly readOnly?: boolean; readonly idempotent?: boolean }
    | undefined
): ToolAnnotations | undefined {
  if (!mcp) return undefined;

  const annotations: Record<string, boolean> = {};
  let hasAnnotation = false;

  if (mcp.readOnly === true) {
    annotations["readOnlyHint"] = true;
    hasAnnotation = true;
  }
  if (mcp.idempotent === true) {
    annotations["idempotentHint"] = true;
    hasAnnotation = true;
  }

  return hasAnnotation ? (annotations as ToolAnnotations) : undefined;
}

export function buildMcpTools(
  source: ActionSource,
  options: BuildMcpToolsOptions = {}
): ToolDefinition<unknown, unknown>[] {
  const actions = isActionRegistry(source) ? source.list() : source;
  const includeSurfaces: readonly ActionSurface[] = options.includeSurfaces ?? [
    "mcp",
  ];

  return actions
    .filter((action) => {
      const surfaces: readonly ActionSurface[] =
        action.surfaces ?? DEFAULT_REGISTRY_SURFACES;
      return surfaces.some((surface) => includeSurfaces.includes(surface));
    })
    .map((action) => {
      // Map readOnly/idempotent metadata to MCP tool annotations
      const annotations = buildAnnotations(action.mcp);

      return defineTool({
        name: action.mcp?.tool ?? action.id,
        description: action.mcp?.description ?? action.description ?? action.id,
        inputSchema: action.input,
        handler: async (input, ctx) => action.handler(input, ctx),
        ...(action.mcp?.deferLoading !== undefined
          ? { deferLoading: action.mcp.deferLoading }
          : {}),
        ...(annotations ? { annotations } : {}),
      });
    });
}
